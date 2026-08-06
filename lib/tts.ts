"use client";

function speakWithBrowser(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

export async function speakText(text: string, enabled: boolean) {
  if (!enabled || !text.trim() || typeof window === "undefined") return;
  stopSpeaking();
  try {
    const response = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    if (response.ok && response.headers.get("content-type")?.startsWith("audio/")) {
      const url = URL.createObjectURL(await response.blob());
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
      return;
    }
  } catch {
    // Browser speech is the intentionally local fallback for an unconfigured TTS provider.
  }
  speakWithBrowser(text);
}
