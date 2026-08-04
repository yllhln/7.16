/**
 * Live2DCompanion
 * ------------------------------------------------------------
 * 一个"纯展示型"的 Live2D 控制器：没有拖拽、没有对话气泡、没有工具栏按钮、
 * 没有鼠标悬停/点击提示语。模型只做四件事：
 *
 *   1. 默认播放待机（idle）动作
 *   2. AI 对话进行中，循环播放"说话"动作
 *   3. 收到你自定义的条件时，播放一次对应的反应动作
 *   4. 好感度跨过阈值时，整体切换到另一套模型
 *
 * 依赖：
 *   - pixi.js 6.x（UMD 版本，会挂到 window.PIXI）
 *   - pixi-live2d-display 的 cubism2 模块（挂到 window.PIXI.live2d）
 *   - 本仓库自带的 live2d.min.js（Cubism 2 官方运行时）
 *
 * 用法见 README.md 和 demo.html。
 */
(function (global) {
  "use strict";

  class Live2DCompanion {
    constructor(options) {
      if (!options || !options.canvas) {
        throw new Error("[Live2DCompanion] 必须传入 canvas 选项");
      }

      this.options = Object.assign(
        {
          canvas: null, // canvas 元素或选择器字符串
          idleGroup: "idle", // 默认待机动作组名（对应模型 json 里 motions 的 key）
          talkGroup: "tap_body", // "对话进行中"循环播放的动作组名
          talkInterval: 4000, // 对话状态下，每隔多久触发一次 talkGroup 里的动作（毫秒）
          reactions: {}, // 自定义条件 -> 动作映射，例如 { happy: { group: 'tap_body', priority: 'FORCE' } }
          affectionLevels: [{ min: 0, url: "" }], // 好感度分档，按 min 从小到大排序，min 是达到该形象所需的最低好感度
          initialAffection: 0,
          persistAffection: true, // 是否把好感度记在 localStorage 里，刷新页面不丢失
          storageKey: "live2d-companion-affection",
          followCursor: false, // 是否让模型看向鼠标；默认关闭，纯展示不参与"桌宠"式交互
          heightRatio: 0.95, // 模型高度相对画布高度的占比
          anchorX: 0.5,
          anchorY: 1, // (0.5, 1) = 模型底部中心对齐画布底部中心
          scale: null, // 手动指定缩放比例；不填则按 heightRatio 自动计算
          onModelChange: null, // (levelIndex, levelConfig) => void，好感度换模型时触发
          onError: function (err) {
            console.error("[Live2DCompanion]", err);
          },
        },
        options
      );

      this._app = null;
      this._model = null;
      this._talkTimer = null;
      this._currentLevelIndex = -1;

      let initial = this.options.initialAffection;
      if (this.options.persistAffection) {
        const saved = Number(localStorage.getItem(this.options.storageKey));
        if (Number.isFinite(saved) && localStorage.getItem(this.options.storageKey) !== null) {
          initial = saved;
        }
      }
      this._affection = initial;
    }

    /** 初始化 PIXI 应用并加载好感度对应的初始模型，必须 await 完成后再调用其他方法 */
    async mount() {
      const canvas =
        typeof this.options.canvas === "string"
          ? document.querySelector(this.options.canvas)
          : this.options.canvas;
      if (!canvas) {
        throw new Error("[Live2DCompanion] 找不到 canvas 元素: " + this.options.canvas);
      }
      if (!global.PIXI || !global.PIXI.live2d) {
        throw new Error(
          "[Live2DCompanion] 没有找到 PIXI / PIXI.live2d，请确认已经在这个脚本之前引入了 pixi.js 和 pixi-live2d-display 的 cubism2 模块"
        );
      }

      this._canvasEl = canvas;
      this._app = new global.PIXI.Application({
        view: canvas,
        resizeTo: canvas.parentElement || global.window,
        backgroundAlpha: 0,
        autoStart: true,
      });

      await this._loadForAffection(this._affection, true);

      this._onResize = () => this._layout();
      global.window.addEventListener("resize", this._onResize);

      return this;
    }

    // -------------------- 对外的四个核心能力 --------------------

    /** 1. 待机动作：不用手动调用，模型没有其它动作播放时会自动循环 idleGroup */

    /** 2. 开始"对话中"状态：循环播放 talkGroup 里的动作，直到调用 stopTalking() */
    startTalking() {
      if (this._talkTimer || !this._model) return;
      const play = () => this._safeMotion(this.options.talkGroup, undefined, "NORMAL");
      play();
      this._talkTimer = setInterval(play, this.options.talkInterval);
    }

    /** 结束"对话中"状态。不需要手动切回待机，动作播完后会自动回落到 idleGroup */
    stopTalking() {
      if (this._talkTimer) {
        clearInterval(this._talkTimer);
        this._talkTimer = null;
      }
    }

    /**
     * 3. 触发一次自定义条件对应的反应动作。
     * 条件本身由你自己判断（比如检查 AI 回复文本里有没有某些关键词/情绪标签），
     * 判断完了调用 companion.react('happy') 即可。
     */
    react(conditionName) {
      const def = this.options.reactions[conditionName];
      if (!def) {
        console.warn('[Live2DCompanion] 没有为条件 "' + conditionName + '" 配置对应动作，已跳过');
        return;
      }
      this._safeMotion(def.group, def.index, def.priority || "FORCE");
    }

    /** 4a. 直接设置好感度，跨过阈值会自动切换模型 */
    setAffection(value) {
      this._affection = value;
      if (this.options.persistAffection) {
        localStorage.setItem(this.options.storageKey, String(value));
      }
      return this._loadForAffection(value, false);
    }

    /** 4b. 在当前好感度基础上加/减一个值 */
    addAffection(delta) {
      return this.setAffection(this._affection + delta);
    }

    getAffection() {
      return this._affection;
    }

    /** 彻底销毁，离开页面/卸载组件时调用，避免内存泄漏 */
    destroy() {
      this.stopTalking();
      if (this._onResize) global.window.removeEventListener("resize", this._onResize);
      if (this._app) this._app.destroy(true, { children: true });
      this._app = null;
      this._model = null;
    }

    // -------------------- 内部实现 --------------------

    async _loadForAffection(value, isInitial) {
      const levels = this.options.affectionLevels;
      let levelIndex = 0;
      for (let i = 0; i < levels.length; i++) {
        if (value >= levels[i].min) levelIndex = i;
      }
      if (!isInitial && levelIndex === this._currentLevelIndex) {
        return; // 没有跨过新的档位，不用重新加载模型
      }
      this._currentLevelIndex = levelIndex;
      const levelConfig = levels[levelIndex];

      try {
        const newModel = await global.PIXI.live2d.Live2DModel.from(levelConfig.url, {
          autoInteract: this.options.followCursor,
        });

        if (this._model) {
          this._app.stage.removeChild(this._model);
          this._model.destroy();
        }
        this._model = newModel;
        this._app.stage.addChild(this._model);

        // 把配置里的 idleGroup 同步给引擎，这样"没有动作播放时自动待机"用的就是这个组
        if (this.options.idleGroup && this._model.internalModel && this._model.internalModel.motionManager) {
          this._model.internalModel.motionManager.groups.idle = this.options.idleGroup;
        }

        this._layout();

        if (typeof this.options.onModelChange === "function") {
          this.options.onModelChange(levelIndex, levelConfig);
        }
      } catch (err) {
        this.options.onError(err);
      }
    }

    _layout() {
      if (!this._model || !this._app || !this._app.renderer) return;
      const w = this._app.renderer.width;
      const h = this._app.renderer.height;

      // 每次都先把缩放重置为 1 再测量原始高度，避免多次 resize 后缩放误差累积
      this._model.scale.set(1);
      const naturalHeight = this._model.height || 1;
      const finalScale = this.options.scale || (h * this.options.heightRatio) / naturalHeight;

      this._model.scale.set(finalScale);
      this._model.anchor.set(this.options.anchorX, this.options.anchorY);
      this._model.x = w * this.options.anchorX;
      this._model.y = h;
    }

    _safeMotion(group, index, priorityName) {
      if (!this._model || !this._model.internalModel) return;
      const settings = this._model.internalModel.settings;
      const definedGroups = (settings && settings.motions) || (settings && settings.json && settings.json.motions);
      if (definedGroups && !definedGroups[group]) {
        console.warn('[Live2DCompanion] 当前模型没有动作组 "' + group + '"，已跳过。可以在 model 的 index.json 里补充这个分组，或者改用已有的分组名。');
        return;
      }
      const priority =
        (global.PIXI.live2d.MotionPriority && global.PIXI.live2d.MotionPriority[priorityName]) ??
        undefined;
      this._model.motion(group, index, priority);
    }
  }

  global.Live2DCompanion = Live2DCompanion;
})(window);
