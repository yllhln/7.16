"use client";

import type { Live2DExpression, Live2DModelDefinition } from "@/data/live2dModels";

type CoreModel = {
  getParameterValueById?: (id: string) => number;
  setParameterValueById?: (id: string, value: number) => void;
  getParamFloat?: (id: string) => number;
  setParamFloat?: (id: string, value: number) => void;
};

type Live2DModelInstance = {
  width: number;
  height: number;
  x: number;
  y: number;
  scale: { set: (value: number) => void };
  anchor: { set: (x: number, y: number) => void };
  internalModel?: { coreModel?: CoreModel };
  motion?: (group: string, index?: number, priority?: number) => void;
  destroy?: () => void;
};

type PixiApp = {
  stage: { addChild: (child: Live2DModelInstance) => void };
  destroy: (removeView?: boolean, options?: { children?: boolean }) => void;
};

const CUBISM4_CORE_URL = "/live2d/runtime/cubism4/live2dcubismcore.min.js";
const CUBISM2_CORE_URL = "/live2d/runtime/cubism2/live2d.min.js";

function easeInOutCubic(progress: number) {
  return progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

async function ensureCubism4Core() {
  if ((window as Window & { Live2DCubismCore?: unknown }).Live2DCubismCore) return;
  const existing = document.querySelector<HTMLScriptElement>('script[data-live2d-core="cubism4"]');
  if (existing) {
    await new Promise<void>((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Cubism 4 Core could not load.")), { once: true });
    });
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CUBISM4_CORE_URL;
    script.async = true;
    script.dataset.live2dCore = "cubism4";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Cubism 4 Core is missing from local assets."));
    document.head.appendChild(script);
  });
}

async function ensureCubism2Core() {
  if ((window as Window & { Live2D?: unknown }).Live2D) return;
  const existing = document.querySelector<HTMLScriptElement>('script[data-live2d-core="cubism2"]');
  if (existing) {
    await new Promise<void>((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Cubism 2 Core could not load.")), { once: true });
    });
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CUBISM2_CORE_URL;
    script.async = true;
    script.dataset.live2dCore = "cubism2";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Cubism 2 Core is missing from local assets."));
    document.head.appendChild(script);
  });
}

export class Live2DController {
  private app: PixiApp | null = null;
  private model: Live2DModelInstance | null = null;
  private animationFrame: number | null = null;
  private resetTimer: number | null = null;
  private resizeHandler: (() => void) | null = null;

  constructor(private canvas: HTMLCanvasElement, private definition: Live2DModelDefinition) {}

  async init() {
    if (this.definition.runtime === "cubism2") await ensureCubism2Core();
    else await ensureCubism4Core();
    const PIXI = await import("pixi.js");
    const { Live2DModel } = this.definition.runtime === "cubism2"
      ? await import("pixi-live2d-display/cubism2")
      : await import("pixi-live2d-display/cubism4");
    (window as Window & { PIXI?: unknown }).PIXI = PIXI;

    const app = new PIXI.Application({ view: this.canvas, transparent: true, resizeTo: this.canvas.parentElement || window, antialias: true });
    const model = await Live2DModel.from(this.definition.entryUrl, { autoInteract: false }) as Live2DModelInstance;
    this.app = app as unknown as PixiApp;
    this.model = model;
    this.app.stage.addChild(model);
    this.resizeHandler = () => this.layout();
    window.addEventListener("resize", this.resizeHandler);
    this.layout();
  }

  destroy() {
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    if (this.resetTimer) window.clearTimeout(this.resetTimer);
    if (this.resizeHandler) window.removeEventListener("resize", this.resizeHandler);
    this.model?.destroy?.();
    this.app?.destroy?.(true, { children: true });
    this.model = null;
    this.app = null;
  }

  private layout() {
    if (!this.model || !this.canvas.parentElement) return;
    const host = this.canvas.parentElement;
    const scale = Math.min(host.clientWidth / this.model.width, host.clientHeight / this.model.height) * (this.definition.layout?.scale || 0.86);
    this.model.scale.set(scale);
    this.model.anchor.set(0.5, 1);
    this.model.x = host.clientWidth * (0.5 + (this.definition.layout?.offsetX || 0));
    this.model.y = host.clientHeight * (1 + (this.definition.layout?.offsetY || 0));
  }

  playMotion(group?: string) {
    if (!group || !this.model) return;
    try { this.model.motion?.(group, undefined, 2); } catch { /* Optional model motion groups may be absent. */ }
  }

  applyExpression(expression: Live2DExpression) {
    if (!this.model) return;
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    if (this.resetTimer) window.clearTimeout(this.resetTimer);

    const core = this.model.internalModel?.coreModel;
    if (!core) return;
    const from: Record<string, number> = {};
    for (const id of Object.keys(expression.parameters)) from[id] = core.getParameterValueById?.(id) ?? core.getParamFloat?.(id) ?? 0;
    this.animate(core, from, expression.parameters, expression.durationMs, () => {
      this.resetTimer = window.setTimeout(() => this.animate(core, expression.parameters, from, expression.durationMs), expression.holdMs);
    });
  }

  private animate(core: CoreModel, from: Record<string, number>, to: Record<string, number>, durationMs: number, done?: () => void) {
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = easeInOutCubic(progress);
      for (const id of Object.keys(to)) {
        const value = (from[id] ?? 0) + ((to[id] ?? 0) - (from[id] ?? 0)) * eased;
        if (core.setParameterValueById) core.setParameterValueById(id, value);
        else core.setParamFloat?.(id, value);
      }
      if (progress < 1) this.animationFrame = requestAnimationFrame(tick);
      else { this.animationFrame = null; done?.(); }
    };
    this.animationFrame = requestAnimationFrame(tick);
  }
}
