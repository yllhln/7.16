"use client";

import type * as PIXI from "pixi.js";
import type { Live2DModel } from "pixi-live2d-display/cubism4";
import type { MotionPriority } from "pixi-live2d-display";
import { LipSyncRuntime, type AudioAnalysis, type AudioRuntime } from "@/lib/audioRuntime";

declare global {
  interface Window {
    Live2DCubismCore?: unknown;
    PIXI?: typeof PIXI;
  }
}

export interface Live2DRuntimeOptions {
  container: HTMLElement;
  modelUrl: string;
  coreScriptUrl?: string;
  backgroundUrl?: string;
  foregroundUrl?: string;
  behaviorProfile?: Live2DMapping["behaviorProfile"];
  clipInset?: number;
  minZoom?: number;
  maxZoom?: number;
}

export interface Live2DMappingEntry {
  id: string;
  file: string;
  name?: string;
  group?: string;
  index?: number;
}

export interface Live2DLookAtMapping {
  parameterId: string;
  input?: string;
  inputRange?: [number, number];
  outputRange?: [number, number];
}

export interface Live2DLipSyncMapping {
  parameterId: string;
  inputRange?: [number, number];
  outputRange?: [number, number];
}

export interface Live2DMapping {
  schemaVersion: number;
  modelId: string;
  displayName?: string;
  lookAt?: Partial<Record<"eyeX" | "eyeY" | "headX" | "headY", Live2DLookAtMapping>>;
  lipSync?: { mouthOpen?: Live2DLipSyncMapping };
  expressions: Live2DMappingEntry[];
  motions: Live2DMappingEntry[];
  behaviorProfile?: Record<string, { expression?: string | null; motion?: string | null }>;
}

export interface Live2DLookAtTarget {
  x: number;
  y: number;
  space?: "viewport" | "normalized";
}

export interface Live2DEmotionResult {
  emotion: string;
  expression: boolean;
  motion: boolean;
}

interface Live2DCoreModelParameters {
  getParameterIndex(parameterId: string): number;
  setParameterValueById(parameterId: string, value: number, weight?: number): void;
}

export interface Live2DRuntimeSnapshot {
  loaded: boolean;
  destroyed: boolean;
  modelUrl: string;
}

let cubismCorePromise: Promise<void> | undefined;
let tickerRegistered = false;

interface CubismModelSource {
  url?: string;
  FileReferences: {
    [key: string]: unknown;
    Moc: string;
    Textures: string[];
  };
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function parseMapping(value: unknown): Live2DMapping | undefined {
  if (!isRecord(value) || typeof value.schemaVersion !== "number" || typeof value.modelId !== "string") {
    return undefined;
  }
  const parseEntries = (entries: unknown): Live2DMappingEntry[] => {
    if (!Array.isArray(entries)) return [];
    return entries.filter(isRecord).flatMap((entry) => {
      if (typeof entry.id !== "string" || typeof entry.file !== "string") return [];
      return [{
        id: entry.id,
        file: entry.file,
        name: typeof entry.name === "string" ? entry.name : undefined,
        group: typeof entry.group === "string" ? entry.group : undefined,
        index: typeof entry.index === "number" ? entry.index : undefined,
      }];
    });
  };
  const lookAt: Live2DMapping["lookAt"] = {};
  if (isRecord(value.lookAt)) {
    for (const key of ["eyeX", "eyeY", "headX", "headY"] as const) {
      const entry = value.lookAt[key];
      if (!isRecord(entry) || typeof entry.parameterId !== "string") continue;
      lookAt[key] = {
        parameterId: entry.parameterId,
        input: typeof entry.input === "string" ? entry.input : undefined,
        inputRange: Array.isArray(entry.inputRange) && entry.inputRange.length === 2
          ? [Number(entry.inputRange[0]), Number(entry.inputRange[1])]
          : undefined,
        outputRange: Array.isArray(entry.outputRange) && entry.outputRange.length === 2
          ? [Number(entry.outputRange[0]), Number(entry.outputRange[1])]
          : undefined,
      };
    }
  }
  const lipSync: Live2DMapping["lipSync"] = {};
  if (isRecord(value.lipSync) && isRecord(value.lipSync.mouthOpen) && typeof value.lipSync.mouthOpen.parameterId === "string") {
    const entry = value.lipSync.mouthOpen;
    lipSync.mouthOpen = {
      parameterId: String(entry.parameterId),
      inputRange: Array.isArray(entry.inputRange) && entry.inputRange.length === 2
        ? [Number(entry.inputRange[0]), Number(entry.inputRange[1])]
        : undefined,
      outputRange: Array.isArray(entry.outputRange) && entry.outputRange.length === 2
        ? [Number(entry.outputRange[0]), Number(entry.outputRange[1])]
        : undefined,
    };
  }
  const behaviorProfile: Live2DMapping["behaviorProfile"] = {};
  if (isRecord(value.behaviorProfile)) {
    for (const [emotion, profile] of Object.entries(value.behaviorProfile)) {
      if (!isRecord(profile)) continue;
      behaviorProfile[emotion] = {
        expression: typeof profile.expression === "string" ? profile.expression : null,
        motion: typeof profile.motion === "string" ? profile.motion : null,
      };
    }
  }
  return {
    schemaVersion: value.schemaVersion,
    modelId: value.modelId,
    displayName: typeof value.displayName === "string" ? value.displayName : undefined,
    lookAt,
    lipSync,
    expressions: parseEntries(value.expressions),
    motions: parseEntries(value.motions),
    behaviorProfile,
  };
}

function loadCubismCore(scriptUrl: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Live2D runtime requires a browser environment."));
  }

  if (window.Live2DCubismCore) {
    return Promise.resolve();
  }

  if (cubismCorePromise) {
    return cubismCorePromise;
  }

  cubismCorePromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-live2d-cubism-core="true"]',
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load the Cubism Core runtime.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.dataset.live2dCubismCore = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load Cubism Core from ${scriptUrl}.`));
    document.head.appendChild(script);
  });

  return cubismCorePromise;
}

function destroyApplication(app: PIXI.Application | undefined): void {
  if (!app) return;

  const view = app.view;
  app.destroy(true, {
    children: true,
    texture: true,
    baseTexture: true,
  });
  if (view.parentNode) {
    view.parentNode.removeChild(view);
  }
}

export class Live2DRuntimeHandle {
  private readonly options: Live2DRuntimeOptions;
  private app?: PIXI.Application;
  private model?: Live2DModel;
  private loading?: Promise<Live2DModel>;
  private cleanupListeners: Array<() => void> = [];
  private mapping?: Live2DMapping;
  private pendingLookAt?: Live2DLookAtTarget;
  private lipSyncParameterId?: string;
  private audioUnsubscribe?: () => void;
  private destroyed = false;

  constructor(options: Live2DRuntimeOptions) {
    this.options = options;
  }

  async load(): Promise<Live2DModel> {
    if (this.destroyed) {
      throw new Error("Cannot load a destroyed Live2D runtime.");
    }
    if (this.model) return this.model;
    if (this.loading) return this.loading;

    this.loading = this.loadModel();
    try {
      this.model = await this.loading;
      return this.model;
    } finally {
      this.loading = undefined;
    }
  }

  getApplication(): PIXI.Application | undefined {
    return this.app;
  }

  getModel(): Live2DModel | undefined {
    return this.model;
  }

  getMapping(): Live2DMapping | undefined {
    return this.mapping;
  }

  async playExpression(name: string): Promise<boolean> {
    const model = await this.load().catch(() => undefined);
    const expression = this.mapping?.expressions.find((entry) => entry.id === name);
    if (!model || !expression) return false;
    try {
      return await model.expression(expression.id);
    } catch {
      return false;
    }
  }

  async playMotion(name: string, priority: MotionPriority = 2 as MotionPriority): Promise<boolean> {
    const model = await this.load().catch(() => undefined);
    const motion = this.mapping?.motions.find((entry) => entry.id === name);
    if (!model || !motion) return false;
    try {
      return await model.motion(motion.group ?? "Idle", motion.index ?? 0, priority);
    } catch {
      return false;
    }
  }

  async playEmotion(emotion: string): Promise<Live2DEmotionResult> {
    const profile = this.mapping?.behaviorProfile;
    const resolvedEmotion = profile?.[emotion] ? emotion : "neutral";
    const selection = profile?.[resolvedEmotion];
    const expression = selection?.expression ? await this.playExpression(selection.expression) : false;
    const motion = selection?.motion ? await this.playMotion(selection.motion) : false;
    return { emotion: resolvedEmotion, expression, motion };
  }

  setLipSync(value: number): void {
    const model = this.model;
    const parameterId = this.lipSyncParameterId;
    if (!model || !parameterId) return;
    const outputRange = this.mapping?.lipSync?.mouthOpen?.outputRange ?? [0, 1];
    const minimum = Math.min(outputRange[0], outputRange[1]);
    const maximum = Math.max(outputRange[0], outputRange[1]);
    const bounded = Math.min(Math.max(value, minimum), maximum);
    const coreModel = model.internalModel.coreModel as unknown as Live2DCoreModelParameters;
    coreModel.setParameterValueById(parameterId, bounded);
  }

  attachAudioRuntime(audio: AudioRuntime): () => void {
    this.audioUnsubscribe?.();
    const lipSync = new LipSyncRuntime({
      sink: (mouthOpen) => this.setLipSync(mouthOpen),
      inputRange: this.mapping?.lipSync?.mouthOpen?.inputRange,
      outputRange: this.mapping?.lipSync?.mouthOpen?.outputRange,
    });
    this.audioUnsubscribe = audio.subscribe((analysis: AudioAnalysis) => lipSync.consume(analysis));
    return () => {
      this.audioUnsubscribe?.();
      this.audioUnsubscribe = undefined;
      lipSync.reset();
    };
  }

  setLookAt(target: Live2DLookAtTarget): void {
    this.pendingLookAt = target;
    if (!this.model) return;
    const point = this.resolveLookAtTarget(target);
    this.model.focus(point.x, point.y);
  }

  getSnapshot(): Live2DRuntimeSnapshot {
    return {
      loaded: Boolean(this.model),
      destroyed: this.destroyed,
      modelUrl: this.options.modelUrl,
    };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.audioUnsubscribe?.();
    this.audioUnsubscribe = undefined;
    this.cleanupListeners.splice(0).forEach((cleanup) => cleanup());

    const model = this.model;
    this.model = undefined;
    this.mapping = undefined;
    this.lipSyncParameterId = undefined;
    if (model) {
      model.autoUpdate = false;
      if (model.parent) {
        model.parent.removeChild(model);
      }
      (model as unknown as { removeAllListeners?: () => void }).removeAllListeners?.();
      model.destroy({
        children: true,
        texture: true,
        baseTexture: true,
      });
    }

    const app = this.app;
    this.app = undefined;
    destroyApplication(app);
  }

  private async loadModel(): Promise<Live2DModel> {
    const { container, modelUrl } = this.options;
    if (typeof window === "undefined") {
      throw new Error("Live2D runtime requires a browser environment.");
    }
    if (!container.isConnected) {
      throw new Error("Live2D runtime container must be connected to the document.");
    }

    await loadCubismCore(
      this.options.coreScriptUrl ?? "/live2d/runtime/live2dcubismcore.min.js",
    );
    const PIXI = await import("pixi.js");
    const { Live2DModel, cubism4Ready } = await import(
      "pixi-live2d-display/cubism4"
    );
    await cubism4Ready();

    if (!tickerRegistered) {
      Live2DModel.registerTicker(PIXI.Ticker);
      tickerRegistered = true;
    }
    window.PIXI = PIXI;

    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    const app = new PIXI.Application({
      width,
      height,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });
    this.app = app;
    app.view.style.display = "block";
    app.view.style.width = "100%";
    app.view.style.height = "100%";
    container.appendChild(app.view);

    try {
      const backgroundLayer = new PIXI.Container();
      const modelLayer = new PIXI.Container();
      const foregroundLayer = new PIXI.Container();
      const clipMask = new PIXI.Graphics();
      const inset = Math.max(this.options.clipInset ?? 0, 0);

      if (this.options.backgroundUrl) {
        const background = PIXI.Sprite.from(this.options.backgroundUrl);
        background.anchor.set(0.5);
        background.x = width / 2;
        background.y = height / 2;
        const backgroundScale = Math.max(
          width / Math.max(background.texture.width, 1),
          height / Math.max(background.texture.height, 1),
        );
        background.scale.set(backgroundScale);
        backgroundLayer.addChild(background);
      }

      clipMask.beginFill(0xffffff);
      clipMask.drawRect(inset, inset, Math.max(width - inset * 2, 1), Math.max(height - inset * 2, 1));
      clipMask.endFill();
      modelLayer.mask = clipMask;
      app.stage.addChild(backgroundLayer, modelLayer, foregroundLayer);

      if (this.options.foregroundUrl) {
        const foreground = PIXI.Sprite.from(this.options.foregroundUrl);
        foreground.anchor.set(0.5);
        foreground.x = width / 2;
        foreground.y = height / 2;
        const foregroundScale = Math.max(
          width / Math.max(foreground.texture.width, 1),
          height / Math.max(foreground.texture.height, 1),
        );
        foreground.scale.set(foregroundScale);
        foregroundLayer.addChild(foreground);
      }

      const { source, mapping } = await this.loadModelSource(modelUrl);
      this.mapping = mapping
        ? {
          ...mapping,
          behaviorProfile: this.options.behaviorProfile ?? mapping.behaviorProfile,
        }
        : mapping;
      const model = await Live2DModel.from(source, {
        autoInteract: false,
        autoUpdate: true,
      });

      if (this.destroyed) {
        model.autoUpdate = false;
        model.destroy({
          children: true,
          texture: true,
          baseTexture: true,
        });
        throw new Error("Live2D runtime was destroyed while loading.");
      }

      const modelWidth = Math.max(model.internalModel.width, 1);
      const modelHeight = Math.max(model.internalModel.height, 1);
      const scale = Math.min(width / modelWidth, height / modelHeight) * 0.9;
      model.anchor.set(0.5, 1);
      model.scale.set(scale);
      model.x = width / 2;
      model.y = height;
      modelLayer.addChild(model);
      this.applyLookAtMapping(model, mapping);
      this.applyLipSyncMapping(model, mapping);
      if (this.pendingLookAt) {
        const point = this.resolveLookAtTarget(this.pendingLookAt);
        model.focus(point.x, point.y, true);
      }
      this.installInteraction(app.view, model, scale);
      return model;
    } catch (error) {
      this.app = undefined;
      destroyApplication(app);
      throw error;
    }
  }

  private async loadModelSource(modelUrl: string): Promise<{
    source: CubismModelSource;
    mapping?: Live2DMapping;
  }> {
    const response = await fetch(modelUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load Live2D model settings (${response.status}).`);
    }
    const source = (await response.json()) as CubismModelSource;
    source.url = modelUrl;

    const slash = modelUrl.lastIndexOf("/");
    const mappingUrl = `${slash >= 0 ? modelUrl.slice(0, slash + 1) : ""}mapping.json`;
    let mapping: Live2DMapping | undefined;
    try {
      const mappingResponse = await fetch(mappingUrl, { cache: "no-store" });
      if (mappingResponse.ok) {
        mapping = parseMapping(await mappingResponse.json());
      }
    } catch {
      mapping = undefined;
    }

    if (mapping) {
      const expressions = mapping.expressions.map((entry) => ({
        Name: entry.id,
        File: entry.file,
      }));
      const motions: Record<string, Array<{ File: string; Name?: string }>> = {};
      for (const entry of mapping.motions) {
        const group = entry.group ?? "Idle";
        const list = motions[group] ?? [];
        list[entry.index ?? list.length] = { File: entry.file, Name: entry.name };
        motions[group] = list;
      }
      source.FileReferences.Expressions = expressions;
      source.FileReferences.Motions = motions;
    }
    return { source, mapping };
  }

  private applyLookAtMapping(model: Live2DModel, mapping?: Live2DMapping): void {
    if (!mapping?.lookAt) return;
    const internal = model.internalModel as unknown as {
      coreModel?: { getParameterIndex?: (parameterId: string) => number };
      idParamEyeBallX?: string;
      idParamEyeBallY?: string;
      idParamAngleX?: string;
      idParamAngleY?: string;
    };
    const coreModel = internal.coreModel;
    const apply = (key: keyof NonNullable<Live2DMapping["lookAt"]>, field: keyof typeof internal) => {
      const parameterId = mapping.lookAt?.[key]?.parameterId;
      if (!parameterId) return;
      if (coreModel?.getParameterIndex && coreModel.getParameterIndex(parameterId) < 0) return;
      internal[field] = parameterId;
    };
    apply("eyeX", "idParamEyeBallX");
    apply("eyeY", "idParamEyeBallY");
    apply("headX", "idParamAngleX");
    apply("headY", "idParamAngleY");
  }

  private applyLipSyncMapping(model: Live2DModel, mapping?: Live2DMapping): void {
    const parameterId = mapping?.lipSync?.mouthOpen?.parameterId;
    if (!parameterId) return;
    const coreModel = model.internalModel.coreModel as unknown as Live2DCoreModelParameters;
    const index = coreModel.getParameterIndex(parameterId);
    if (index >= 0) this.lipSyncParameterId = parameterId;
  }

  private resolveLookAtTarget(target: Live2DLookAtTarget): { x: number; y: number } {
    if (target.space !== "normalized") return target;
    const width = this.app?.screen.width ?? this.options.container.clientWidth;
    const height = this.app?.screen.height ?? this.options.container.clientHeight;
    return {
      x: ((target.x + 1) / 2) * Math.max(width, 1),
      y: ((target.y + 1) / 2) * Math.max(height, 1),
    };
  }

  private installInteraction(
    view: HTMLCanvasElement,
    model: Live2DModel,
    initialScale: number,
  ): void {
    const pointers = new Map<number, { x: number; y: number }>();
    let dragging = false;
    let lastPoint = { x: 0, y: 0 };
    let zoom = initialScale;
    const minZoom = initialScale * (this.options.minZoom ?? 0.65);
    const maxZoom = initialScale * (this.options.maxZoom ?? 1.6);

    const clampZoom = (value: number) => Math.min(Math.max(value, minZoom), maxZoom);
    const applyZoom = (value: number) => {
      zoom = clampZoom(value);
      model.scale.set(zoom);
    };
    const distance = () => {
      const values = Array.from(pointers.values());
      if (values.length < 2) return 0;
      return Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
    };
    let pinchDistance = 0;

    const onPointerDown = (event: PointerEvent) => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      view.setPointerCapture?.(event.pointerId);
      const rect = view.getBoundingClientRect();
      model.focus(event.clientX - rect.left, event.clientY - rect.top);
      if (pointers.size === 1) {
        dragging = true;
        lastPoint = { x: event.clientX, y: event.clientY };
      } else if (pointers.size === 2) {
        dragging = false;
        pinchDistance = distance();
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      const previous = pointers.get(event.pointerId);
      if (!previous) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const rect = view.getBoundingClientRect();
      model.focus(event.clientX - rect.left, event.clientY - rect.top);

      if (pointers.size >= 2) {
        const nextDistance = distance();
        if (pinchDistance > 0 && nextDistance > 0) {
          applyZoom(zoom * (nextDistance / pinchDistance));
        }
        pinchDistance = nextDistance;
        return;
      }

      if (dragging) {
        model.x += event.clientX - lastPoint.x;
        model.y += event.clientY - lastPoint.y;
        lastPoint = { x: event.clientX, y: event.clientY };
      }
    };
    const endPointer = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinchDistance = 0;
      if (pointers.size === 0) dragging = false;
      view.releasePointerCapture?.(event.pointerId);
    };
    const onPointerLeave = () => {
      model.focus(view.clientWidth / 2, view.clientHeight / 2);
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      applyZoom(zoom * (event.deltaY < 0 ? 1.08 : 0.92));
    };

    view.style.touchAction = "none";
    view.addEventListener("pointerdown", onPointerDown);
    view.addEventListener("pointermove", onPointerMove);
    view.addEventListener("pointerup", endPointer);
    view.addEventListener("pointercancel", endPointer);
    view.addEventListener("pointerleave", onPointerLeave);
    view.addEventListener("wheel", onWheel, { passive: false });

    this.cleanupListeners.push(() => {
      view.removeEventListener("pointerdown", onPointerDown);
      view.removeEventListener("pointermove", onPointerMove);
      view.removeEventListener("pointerup", endPointer);
      view.removeEventListener("pointercancel", endPointer);
      view.removeEventListener("pointerleave", onPointerLeave);
      view.removeEventListener("wheel", onWheel);
      pointers.clear();
    });
  }
}
