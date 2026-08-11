"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  History,
  ImagePlus,
  Mic,
  Plus,
  Send,
  Square,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Live2DCanvas from "@/components/Live2DCanvas";
import { live2dModels } from "@/data/live2dModels";
import { vtuberConfig } from "@/data/vtuberConfig";
import { useCloudVTuber } from "@/hooks/useCloudVTuber";
import type { ImageAttachment } from "@/lib/vtuber/types";

function readImage(file: File) {
  return new Promise<ImageAttachment>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve({ name: file.name, mimeType: file.type, base64: value.split(",")[1] || "" });
    };
    reader.readAsDataURL(file);
  });
}

export default function VTuberWidget() {
  const {
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
    expression,
    mouthOpen,
    error,
    serviceConfigured,
    asrConfigured,
  } = useCloudVTuber();
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<ImageAttachment | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const models = live2dModels.filter((model) => model.enabled);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [activeSession?.messages, busy]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if ((!text && !attachment) || busy) return;
    const selectedAttachment = attachment;
    setInput("");
    setAttachment(null);
    await sendMessage(text, selectedAttachment);
  };

  const toggleRecording = async () => {
    if (isRecording) {
      try {
        const transcript = await stopRecording();
        if (transcript) setInput((current) => [current.trim(), transcript].filter(Boolean).join(" "));
      } catch {
        // Hook exposes the transcription error in the UI.
      }
      return;
    }
    try {
      await startRecording();
    } catch (reason) {
      console.error(reason);
    }
  };

  const statusText = isRecording
    ? "录音中"
    : isTranscribing
      ? "识别中"
      : busy
        ? "思考中"
        : isSpeaking
          ? "朗读中"
          : serviceConfigured === false
            ? "待配置"
            : "待命";

  return (
    <main className="min-h-[100dvh] bg-slate-950 text-slate-100">
      <Navbar />
      <section className="mx-auto flex min-h-[100dvh] max-w-[1500px] flex-col px-0 pb-0 pt-16 md:px-5 md:pb-5 md:pt-20">
        <div className="grid min-h-0 flex-1 overflow-hidden border-y border-white/10 bg-slate-950 shadow-2xl md:border lg:grid-cols-[minmax(320px,0.86fr)_minmax(460px,1.24fr)]">
          <section className="relative min-h-[36dvh] overflow-hidden border-b border-white/10 bg-slate-900 lg:min-h-0 lg:border-b-0 lg:border-r">
            <div className="absolute inset-0 bg-[url('/assets/site/cover.png')] bg-cover bg-center opacity-35" />
            <div className="absolute inset-0 bg-slate-950/60" />
            <div className="absolute left-3 right-3 top-3 z-10 flex items-center justify-between gap-3">
              <select
                value={modelId}
                onChange={(event) => setModelId(event.target.value)}
                className="min-w-0 max-w-[70%] border border-white/15 bg-slate-950/75 px-3 py-2 text-sm outline-none focus:border-teal-400"
                aria-label="Live2D model"
              >
                {models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
              </select>
              <span className={`shrink-0 text-xs font-semibold ${serviceConfigured === false ? "text-amber-300" : "text-teal-300"}`}>{statusText}</span>
            </div>
            <div className="absolute inset-x-0 bottom-0 top-12">
              <Live2DCanvas modelId={modelId} expression={expression} mouthOpen={mouthOpen} />
            </div>
            <div className="absolute bottom-4 left-4 z-10">
              <h1 className="text-2xl font-bold text-white">{vtuberConfig.assistantName}</h1>
            </div>
          </section>

          <section className="relative flex min-h-[58dvh] min-w-0 flex-col bg-slate-950/95 lg:min-h-0">
            <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-3 sm:px-4">
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setHistoryOpen((value) => !value)} className="grid h-9 w-9 place-items-center text-slate-300 hover:bg-white/10 hover:text-white" title="对话历史"><History size={18} /></button>
                <button type="button" onClick={createSession} className="grid h-9 w-9 place-items-center text-slate-300 hover:bg-white/10 hover:text-white" title="新建对话"><Plus size={18} /></button>
              </div>
              <div className="min-w-0 truncate px-3 text-sm font-semibold text-slate-200">{activeSession?.title || "新对话"}</div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setVoiceEnabled((value) => !value)} className="grid h-9 w-9 place-items-center text-slate-300 hover:bg-white/10 hover:text-white" title={voiceEnabled ? "关闭语音" : "开启语音"}>{voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
                <button type="button" onClick={interrupt} disabled={!busy && !isSpeaking} className="grid h-9 w-9 place-items-center text-slate-300 hover:bg-rose-500/20 hover:text-rose-200 disabled:opacity-30" title="停止"><Square size={16} /></button>
              </div>
            </header>

            <aside className={`absolute bottom-0 left-0 top-14 z-30 flex w-[min(82vw,290px)] flex-col border-r border-white/10 bg-slate-950 shadow-2xl transition-transform duration-200 ${historyOpen ? "translate-x-0" : "-translate-x-full"}`}>
              <div className="flex h-12 items-center justify-between border-b border-white/10 px-4">
                <span className="text-sm font-semibold">对话</span>
                <button type="button" onClick={() => setHistoryOpen(false)} className="grid h-8 w-8 place-items-center text-slate-400 hover:bg-white/10 hover:text-white" title="关闭"><X size={17} /></button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {sessions.map((session) => (
                  <div key={session.id} className={`group flex border-b border-white/5 ${session.id === activeSessionId ? "bg-teal-500/10" : "hover:bg-white/5"}`}>
                    <button type="button" onClick={() => { setActiveSessionId(session.id); setHistoryOpen(false); }} className="min-w-0 flex-1 px-4 py-3 text-left">
                      <span className="block truncate text-sm text-slate-200">{session.title}</span>
                      <span className="mt-1 block text-xs text-slate-500">{session.messages.length} 条消息</span>
                    </button>
                    <button type="button" onClick={() => deleteSession(session.id)} className="grid w-10 place-items-center text-slate-600 hover:text-rose-300" title="删除对话"><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            </aside>

            <div ref={scrollRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-8">
              {!activeSession?.messages.length ? (
                <div className="grid min-h-full place-items-center py-20 text-center">
                  <p className="text-sm text-slate-500">对话从这里开始。</p>
                </div>
              ) : null}
              {activeSession?.messages.map((message) => (
                <article key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] whitespace-pre-wrap px-4 py-3 text-sm leading-7 sm:max-w-[76%] ${message.role === "user" ? "bg-teal-700 text-white" : "border border-white/10 bg-slate-900 text-slate-100"}`}>
                    {message.attachmentName ? <p className="mb-1 text-xs text-teal-200">{message.attachmentName}</p> : null}
                    {message.text}
                  </div>
                </article>
              ))}
              {busy ? <p className="text-sm text-amber-200/75">正在思考...</p> : null}
              {error ? <p className="border-l-2 border-rose-400 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}
            </div>

            <form onSubmit={submit} className="shrink-0 border-t border-white/10 bg-slate-950 p-3 sm:p-4">
              {attachment ? (
                <div className="mb-2 flex items-center justify-between border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
                  <span className="truncate">{attachment.name}</span>
                  <button type="button" onClick={() => setAttachment(null)} className="ml-3 text-slate-400 hover:text-white">移除</button>
                </div>
              ) : null}
              <div className="flex items-end gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (file) setAttachment(await readImage(file));
                    event.target.value = "";
                  }}
                />
                <button type="button" onClick={() => fileRef.current?.click()} className="grid h-11 w-11 shrink-0 place-items-center border border-white/15 text-slate-300 hover:bg-white/10 hover:text-white" title="添加图片"><ImagePlus size={19} /></button>
                <button
                  type="button"
                  onClick={toggleRecording}
                  disabled={asrConfigured === false || isTranscribing}
                  className={`grid h-11 w-11 shrink-0 place-items-center border text-white disabled:opacity-35 ${isRecording ? "border-rose-400 bg-rose-600" : "border-white/15 bg-slate-900 hover:bg-white/10"}`}
                  title={asrConfigured === false ? "ASR 未配置" : isRecording ? "结束录音" : "语音输入"}
                >
                  {isRecording ? <Square size={16} /> : <Mic size={19} />}
                </button>
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  rows={1}
                  placeholder={isTranscribing ? "正在识别语音..." : `和${vtuberConfig.assistantName}聊聊`}
                  className="max-h-36 min-h-11 min-w-0 flex-1 resize-y border border-white/15 bg-slate-900 px-3 py-2.5 text-sm outline-none placeholder:text-slate-600 focus:border-teal-400"
                />
                <button type="submit" disabled={busy || (!input.trim() && !attachment)} className="grid h-11 w-11 shrink-0 place-items-center bg-cyan-700 text-white hover:bg-cyan-600 disabled:opacity-35" title="发送"><Send size={18} /></button>
              </div>
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}
