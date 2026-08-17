"use client";

type VolumeListener = (value: number) => void;

type SpeechOptions = {
  provider?: "auto" | "browser" | "remote";
  voice?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
};

export class SpeechPlayer {
  private abortController: AbortController | null = null;
  private audioContext: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private animationFrame: number | null = null;
  private finish: (() => void) | null = null;

  async speak(text: string, onVolume: VolumeListener, options: SpeechOptions = {}) {
    this.stop();
    const controller = new AbortController();
    this.abortController = controller;

    try {
      if (options.provider !== "browser") {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice: options.voice }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("语音合成失败");

        const contentType = response.headers.get("content-type") || "";
        if (contentType.startsWith("audio/")) {
          const context = new AudioContext();
          this.audioContext = context;
          const buffer = await context.decodeAudioData(await response.arrayBuffer());
          const analyser = context.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.72;

          const source = context.createBufferSource();
          this.source = source;
          source.buffer = buffer;
          source.connect(analyser);
          analyser.connect(context.destination);
          if (typeof options.volume === "number") {
            const gain = context.createGain();
            gain.gain.value = options.volume;
            analyser.disconnect();
            analyser.connect(gain);
            gain.connect(context.destination);
          }

          const samples = new Uint8Array(analyser.fftSize);
          const measure = () => {
            analyser.getByteTimeDomainData(samples);
            let energy = 0;
            for (const sample of samples) {
              const normalized = (sample - 128) / 128;
              energy += normalized * normalized;
            }
            onVolume(Math.min(1, Math.sqrt(energy / samples.length) * 4.2));
            this.animationFrame = requestAnimationFrame(measure);
          };

          await new Promise<void>((resolve) => {
            this.finish = resolve;
            source.onended = () => resolve();
            source.start();
            measure();
          });
          this.releaseAudio(onVolume);
          return;
        }
        if (options.provider === "remote") throw new Error("TTS 云端没有返回音频。");
      }

      await this.speakWithBrowser(text, onVolume, options);
    } catch {
      this.releaseAudio(onVolume);
      if (!controller.signal.aborted && options.provider !== "remote") await this.speakWithBrowser(text, onVolume, options);
    } finally {
      if (this.abortController === controller) this.abortController = null;
    }
  }

  stop() {
    this.abortController?.abort();
    this.abortController = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    try { this.source?.stop(); } catch { /* Source may already be stopped. */ }
    this.finish?.();
    this.releaseAudio(() => undefined);
  }

  private releaseAudio(onVolume: VolumeListener) {
    if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
    this.source?.disconnect();
    this.source = null;
    void this.audioContext?.close();
    this.audioContext = null;
    this.finish = null;
    onVolume(0);
  }

  private speakWithBrowser(text: string, onVolume: VolumeListener, options: SpeechOptions = {}) {
    return new Promise<void>((resolve) => {
      if (!("speechSynthesis" in window)) {
        resolve();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "zh-CN";
      utterance.rate = options.rate ?? 1;
      utterance.pitch = options.pitch ?? 1;
      utterance.volume = options.volume ?? 1;
      const voiceName = options.voice?.trim();
      if (voiceName) {
        const voice = window.speechSynthesis.getVoices().find((item) => item.name === voiceName || item.voiceURI === voiceName);
        if (voice) utterance.voice = voice;
      }
      const animate = () => {
        onVolume(0.18 + Math.abs(Math.sin(performance.now() / 115)) * 0.48);
        this.animationFrame = requestAnimationFrame(animate);
      };
      this.finish = resolve;
      utterance.onstart = animate;
      utterance.onerror = () => resolve();
      utterance.onend = () => resolve();
      window.speechSynthesis.speak(utterance);
    }).finally(() => this.releaseAudio(onVolume));
  }
}
