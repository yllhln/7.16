"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { vtuberConfig } from "@/data/vtuberConfig";
import { defaultAIModelId } from "@/data/aiModels";
import type { Live2DExpression } from "@/data/live2dModels";
import { SpeechPlayer } from "@/lib/vtuber/audio";
import { createVtuberSession, loadVtuberSessions, saveVtuberSessions, titleFromMessage } from "@/lib/vtuber/history";
import type { ImageAttachment, VtuberMessage, VtuberSession } from "@/lib/vtuber/types";

type RecordingState = {
  recorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
  mimeType: string;
};

const VOICE_KEY = "xhblogs:vtuber:voice";
const MODEL_KEY = "xhblogs:vtuber:model";
const AI_MODEL_KEY = "xhblogs:vtuber:ai-model";

export function useCloudVTuber() {
  const [sessions, setSessions] = useState<VtuberSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [modelId, setModelId] = useState(vtuberConfig.defaultModelId);
  const [aiModelId, setAIModelId] = useState(vtuberConfig.defaultAIModelId || defaultAIModelId);
  const [expression, setExpression] = useState<Live2DExpression | null>(null);
  const [triggerText, setTriggerText] = useState("");
  const [mouthOpen, setMouthOpen] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [serviceConfigured, setServiceConfigured] = useState<boolean | null>(null);
  const [asrConfigured, setAsrConfigured] = useState<boolean | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recordingRef = useRef<RecordingState | null>(null);
  const speechRef = useRef(new SpeechPlayer());

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const stored = loadVtuberSessions();
      const initial = stored.length ? stored : [createVtuberSession()];
      setSessions(initial);
      setActiveSessionId(initial[0].id);
      setVoiceEnabled(vtuberConfig.tts.enabled && localStorage.getItem(VOICE_KEY) !== "false");
      setModelId(localStorage.getItem(MODEL_KEY) || vtuberConfig.defaultModelId);
      setAIModelId(localStorage.getItem(AI_MODEL_KEY) || vtuberConfig.defaultAIModelId || defaultAIModelId);
      setHydrated(true);
    });
    void fetch("/api/vtuber/chat").then((response) => response.json()).then((data) => setServiceConfigured(Boolean(data.configured))).catch(() => setServiceConfigured(false));
    void fetch("/api/vtuber/asr").then((response) => response.json()).then((data) => setAsrConfigured(Boolean(data.configured))).catch(() => setAsrConfigured(false));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (hydrated) saveVtuberSessions(sessions);
  }, [hydrated, sessions]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(VOICE_KEY, String(voiceEnabled));
    localStorage.setItem(MODEL_KEY, modelId);
    localStorage.setItem(AI_MODEL_KEY, aiModelId);
    if (!voiceEnabled) {
      speechRef.current.stop();
      setIsSpeaking(false);
      setMouthOpen(0);
    }
  }, [aiModelId, hydrated, modelId, voiceEnabled]);

  useEffect(() => () => {
    abortRef.current?.abort();
    speechRef.current.stop();
    recordingRef.current?.stream.getTracks().forEach((track) => track.stop());
  }, []);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) || sessions[0],
    [activeSessionId, sessions],
  );

  const updateSession = useCallback((sessionId: string, update: (session: VtuberSession) => VtuberSession) => {
    setSessions((current) => current.map((session) => session.id === sessionId ? update(session) : session));
  }, []);

  const appendMessage = useCallback((sessionId: string, message: VtuberMessage) => {
    updateSession(sessionId, (session) => ({
      ...session,
      title: session.messages.some((item) => item.role === "user") ? session.title : titleFromMessage(message.text),
      updatedAt: Date.now(),
      messages: [...session.messages, message],
    }));
  }, [updateSession]);

  const createSession = useCallback(() => {
    const session = createVtuberSession();
    setSessions((current) => [session, ...current].slice(0, vtuberConfig.maxStoredSessions));
    setActiveSessionId(session.id);
    setError(null);
  }, []);

  const deleteSession = useCallback((sessionId: string) => {
    setSessions((current) => {
      const remaining = current.filter((session) => session.id !== sessionId);
      const next = remaining.length ? remaining : [createVtuberSession()];
      setActiveSessionId((active) => active === sessionId ? next[0].id : active);
      return next;
    });
  }, []);

  const interrupt = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    speechRef.current.stop();
    setBusy(false);
    setIsSpeaking(false);
    setMouthOpen(0);
  }, []);

  const sendMessage = useCallback(async (text: string, attachment?: ImageAttachment | null) => {
    const session = sessions.find((item) => item.id === activeSessionId);
    const trimmed = text.trim();
    if (!session || busy || (!trimmed && !attachment)) return;

    interrupt();
    setError(null);
    setBusy(true);
    const userMessage: VtuberMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: trimmed || "请查看这张图片。",
      createdAt: Date.now(),
      attachmentName: attachment?.name,
    };
    appendMessage(session.id, userMessage);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const context = [...session.messages, userMessage]
        .slice(-vtuberConfig.maxContextMessages)
        .map(({ role, text: messageText }) => ({ role, text: messageText }));
      const response = await fetch("/api/vtuber/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: context,
          modelId: aiModelId,
          fileBase64: attachment?.base64,
          fileMimeType: attachment?.mimeType,
        }),
        signal: controller.signal,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "AI 请求失败");

      const assistantMessage: VtuberMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: String(payload.reply),
        createdAt: Date.now(),
      };
      appendMessage(session.id, assistantMessage);
      setTriggerText(assistantMessage.text);

      void fetch("/api/expression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: assistantMessage.text, modelId }),
      }).then((result) => result.ok ? result.json() : null).then((value) => {
        if (value) setExpression(value as Live2DExpression);
      }).catch(() => undefined);

      if (voiceEnabled && vtuberConfig.tts.enabled) {
        setIsSpeaking(true);
        await speechRef.current.speak(assistantMessage.text, setMouthOpen, vtuberConfig.tts);
      }
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) {
        setError(reason instanceof Error ? reason.message : "AI 请求失败");
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setBusy(false);
      setIsSpeaking(false);
      setMouthOpen(0);
    }
  }, [activeSessionId, aiModelId, appendMessage, busy, interrupt, modelId, sessions, voiceEnabled]);

  const startRecording = useCallback(async () => {
    if (recordingRef.current || isTranscribing) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"]
        .find((type) => MediaRecorder.isTypeSupported(type)) || "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const state: RecordingState = { recorder, stream, chunks: [], mimeType: mimeType || recorder.mimeType };
      recorder.ondataavailable = (event) => {
        if (event.data.size) state.chunks.push(event.data);
      };
      recordingRef.current = state;
      recorder.start(250);
      setIsRecording(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法使用麦克风");
      throw reason;
    }
  }, [isTranscribing]);

  const stopRecording = useCallback(() => new Promise<string>((resolve, reject) => {
    const state = recordingRef.current;
    if (!state) {
      resolve("");
      return;
    }
    setIsRecording(false);
    setIsTranscribing(true);
    state.recorder.onstop = async () => {
      state.stream.getTracks().forEach((track) => track.stop());
      recordingRef.current = null;
      try {
        const blob = new Blob(state.chunks, { type: state.mimeType || "audio/webm" });
        const formData = new FormData();
        const extension = state.mimeType.includes("mp4") ? "m4a" : "webm";
        formData.append("audio", blob, `recording.${extension}`);
        const response = await fetch("/api/vtuber/asr", { method: "POST", body: formData });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "语音识别失败");
        resolve(String(payload.text || ""));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "语音识别失败");
        reject(reason);
      } finally {
        setIsTranscribing(false);
      }
    };
    state.recorder.stop();
  }), []);

  return {
    sessions,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    createSession,
    deleteSession,
    sendMessage,
    interrupt,
    busy,
    isSpeaking,
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording,
    voiceEnabled,
    setVoiceEnabled,
    modelId,
    setModelId,
    aiModelId,
    setAIModelId,
    expression,
    triggerText,
    mouthOpen,
    error,
    serviceConfigured,
    asrConfigured,
  };
}
