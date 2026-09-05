"use client";

export interface AudioAnalysis {
  amplitude: number;
  currentTime: number;
  duration: number;
  playing: boolean;
}

export type AudioSource = string | Blob | ArrayBuffer;

export interface TTSAdapter {
  synthesize(text: string): Promise<AudioSource>;
}

export interface FetchTTSAdapterOptions {
  endpoint: string;
  headers?: HeadersInit;
  buildRequest?: (text: string) => BodyInit;
  parseResponse?: (response: Response) => Promise<AudioSource>;
}

export class FetchTTSAdapter implements TTSAdapter {
  private readonly options: FetchTTSAdapterOptions;

  constructor(options: FetchTTSAdapterOptions) {
    this.options = options;
  }

  async synthesize(text: string): Promise<AudioSource> {
    const response = await fetch(this.options.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.options.headers,
      },
      body: this.options.buildRequest?.(text) ?? JSON.stringify({ text }),
    });
    if (!response.ok) {
      throw new Error(`TTS request failed (${response.status}).`);
    }
    return this.options.parseResponse
      ? this.options.parseResponse(response)
      : response.blob();
  }
}

export interface AudioRuntimeOptions {
  fftSize?: number;
}

export type AudioAnalysisListener = (analysis: AudioAnalysis) => void;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export class AudioRuntime {
  private readonly options: AudioRuntimeOptions;
  private readonly audio: HTMLAudioElement;
  private readonly listeners = new Set<AudioAnalysisListener>();
  private context?: AudioContext;
  private sourceNode?: MediaElementAudioSourceNode;
  private analyser?: AnalyserNode;
  private frame?: number;
  private objectUrl?: string;
  private destroyed = false;

  constructor(options: AudioRuntimeOptions = {}) {
    if (!isBrowser()) {
      throw new Error("Audio runtime requires a browser environment.");
    }
    this.options = options;
    this.audio = new Audio();
    this.audio.preload = "auto";
    this.audio.addEventListener("play", this.handlePlay);
    this.audio.addEventListener("pause", this.handlePause);
    this.audio.addEventListener("ended", this.handleEnded);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  get element(): HTMLAudioElement {
    return this.audio;
  }

  get currentTime(): number {
    return this.audio.currentTime || 0;
  }

  get duration(): number {
    return Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
  }

  get playing(): boolean {
    return !this.audio.paused && !this.audio.ended;
  }

  async load(source: AudioSource): Promise<void> {
    this.assertActive();
    this.stop();
    this.revokeObjectUrl();
    this.audio.src = this.resolveSource(source);
    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("Audio source failed to load."));
      };
      const cleanup = () => {
        this.audio.removeEventListener("loadedmetadata", onLoaded);
        this.audio.removeEventListener("error", onError);
      };
      this.audio.addEventListener("loadedmetadata", onLoaded, { once: true });
      this.audio.addEventListener("error", onError, { once: true });
      this.audio.load();
    });
  }

  async play(source?: AudioSource): Promise<void> {
    this.assertActive();
    if (source !== undefined) await this.load(source);
    await this.ensureAnalyser();
    await this.audio.play();
    this.startAnalysisLoop();
  }

  async speak(text: string, adapter: TTSAdapter): Promise<void> {
    const source = await adapter.synthesize(text);
    await this.play(source);
  }

  pause(): void {
    if (this.destroyed) return;
    this.audio.pause();
    this.stopAnalysisLoop();
    this.emitAnalysis();
  }

  stop(): void {
    if (this.destroyed) return;
    this.audio.pause();
    this.audio.currentTime = 0;
    this.stopAnalysisLoop();
    this.emitAnalysis();
  }

  subscribe(listener: AudioAnalysisListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopAnalysisLoop();
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.audio.removeEventListener("play", this.handlePlay);
    this.audio.removeEventListener("pause", this.handlePause);
    this.audio.removeEventListener("ended", this.handleEnded);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.listeners.clear();
    this.sourceNode?.disconnect();
    this.analyser?.disconnect();
    void this.context?.close();
    this.revokeObjectUrl();
  }

  private readonly handlePlay = () => {
    this.startAnalysisLoop();
  };

  private readonly handlePause = () => {
    this.stopAnalysisLoop();
    this.emitAnalysis();
  };

  private readonly handleEnded = () => {
    this.stopAnalysisLoop();
    this.emitAnalysis();
  };

  private readonly handleVisibilityChange = () => {
    if (document.hidden) {
      this.stopAnalysisLoop();
    } else if (this.playing) {
      this.startAnalysisLoop();
    }
  };

  private async ensureAnalyser(): Promise<void> {
    if (this.analyser) {
      if (this.context?.state === "suspended") await this.context.resume();
      return;
    }
    const AudioContextConstructor = window.AudioContext
      ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;
    this.context = new AudioContextConstructor();
    this.sourceNode = this.context.createMediaElementSource(this.audio);
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = this.options.fftSize ?? 1024;
    this.sourceNode.connect(this.analyser);
    this.analyser.connect(this.context.destination);
    await this.context.resume();
  }

  private startAnalysisLoop(): void {
    if (this.frame !== undefined || !this.playing) return;
    const tick = () => {
      this.frame = undefined;
      if (!this.playing) {
        this.emitAnalysis();
        return;
      }
      this.emitAnalysis();
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  private stopAnalysisLoop(): void {
    if (this.frame === undefined) return;
    cancelAnimationFrame(this.frame);
    this.frame = undefined;
  }

  private emitAnalysis(): void {
    const amplitude = this.analyser ? this.readAmplitude() : 0;
    const analysis: AudioAnalysis = {
      amplitude,
      currentTime: this.currentTime,
      duration: this.duration,
      playing: this.playing,
    };
    this.listeners.forEach((listener) => listener(analysis));
  }

  private readAmplitude(): number {
    if (!this.analyser) return 0;
    const values = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(values);
    let sum = 0;
    for (const value of values) {
      const centered = (value - 128) / 128;
      sum += centered * centered;
    }
    return Math.min(Math.sqrt(sum / values.length) * 2, 1);
  }

  private resolveSource(source: AudioSource): string {
    if (typeof source === "string") return source;
    const blob = source instanceof Blob ? source : new Blob([source]);
    this.objectUrl = URL.createObjectURL(blob);
    return this.objectUrl;
  }

  private revokeObjectUrl(): void {
    if (!this.objectUrl) return;
    URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = undefined;
  }

  private assertActive(): void {
    if (this.destroyed) throw new Error("Cannot use a destroyed audio runtime.");
  }
}

export interface LipSyncRuntimeOptions {
  sink: (mouthOpen: number) => void;
  inputRange?: [number, number];
  outputRange?: [number, number];
  smoothing?: number;
}

export class LipSyncRuntime {
  private readonly sink: (mouthOpen: number) => void;
  private readonly inputRange: [number, number];
  private readonly outputRange: [number, number];
  private readonly smoothing: number;
  private value = 0;

  constructor(options: LipSyncRuntimeOptions) {
    this.sink = options.sink;
    this.inputRange = options.inputRange ?? [0, 1];
    this.outputRange = options.outputRange ?? [0, 1];
    this.smoothing = Math.min(Math.max(options.smoothing ?? 0.35, 0), 1);
  }

  consume(analysis: AudioAnalysis): number {
    if (!analysis.playing) {
      this.value = 0;
      this.sink(0);
      return 0;
    }
    const target = mapAmplitudeToMouthOpen(
      analysis.amplitude,
      this.inputRange,
      this.outputRange,
    );
    this.value += (target - this.value) * this.smoothing;
    this.sink(this.value);
    return this.value;
  }

  reset(): void {
    this.value = 0;
    this.sink(0);
  }
}

export function mapAmplitudeToMouthOpen(
  amplitude: number,
  inputRange: [number, number] = [0, 1],
  outputRange: [number, number] = [0, 1],
): number {
  const inputMin = Math.min(inputRange[0], inputRange[1]);
  const inputMax = Math.max(inputRange[0], inputRange[1]);
  const normalized = inputMax === inputMin
    ? 0
    : Math.min(Math.max((amplitude - inputMin) / (inputMax - inputMin), 0), 1);
  return outputRange[0] + normalized * (outputRange[1] - outputRange[0]);
}
