"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { FileUp, Send, Trash2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import { aiModels, defaultAIModelId, getAIModel } from "@/data/aiModels";
import { loadLocal, saveLocal, type StoredMessage } from "@/lib/localChat";

type Attachment = { name: string; text?: string; base64?: string; mimeType?: string };

export default function AIClient() {
  const [modelId, setModelId] = useState(defaultAIModelId);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const model = getAIModel(modelId) || aiModels[0];

  useEffect(() => {
    setMessages(loadLocal("ai-history", modelId, []));
  }, [modelId]);

  useEffect(() => {
    saveLocal("ai-history", modelId, messages);
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, modelId, loading]);

  const addMessage = (message: StoredMessage) => setMessages((current) => [...current, message]);

  const selectFile = (file?: File) => {
    if (!file) return;
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        const value = String(reader.result || "");
        setAttachment({ name: file.name, base64: value.split(",")[1], mimeType: file.type });
      };
      reader.readAsDataURL(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAttachment({ name: file.name, text: String(reader.result || "") });
    reader.readAsText(file);
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if ((!text && !attachment) || loading) return;

    const requestAttachment = attachment;
    const message = requestAttachment?.text ? `${text}\n\n[Attachment: ${requestAttachment.name}]\n${requestAttachment.text}` : text;
    addMessage({ id: crypto.randomUUID(), role: "user", text: text || "Attachment sent", attachmentName: requestAttachment?.name });
    setInput("");
    setAttachment(null);
    setLoading(true);

    try {
      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId, message: message || "Please inspect the attached image.", fileBase64: requestAttachment?.base64, fileMimeType: requestAttachment?.mimeType }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Request failed");
      addMessage({ id: crypto.randomUUID(), role: "assistant", text: data.reply });
    } catch (error) {
      addMessage({ id: crypto.randomUUID(), role: "assistant", text: `Request failed: ${error instanceof Error ? error.message : "Unknown error"}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar />
      <section className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-5 pt-24 sm:px-8">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">AI workspace</p>
            <h1 className="text-2xl font-bold">Chat without a persona</h1>
          </div>
          <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
            {aiModels.map((item) => (
              <button key={item.id} onClick={() => setModelId(item.id)} className={`shrink-0 border px-3 py-2 text-left text-sm transition ${item.id === modelId ? "border-transparent bg-white text-slate-950" : "border-white/15 bg-white/5 hover:bg-white/10"}`}>
                <span className="block font-semibold">{item.name}</span>
                <span className="block text-xs opacity-65">{item.description}</span>
              </button>
            ))}
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col border border-white/10 bg-slate-900/60 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
            <span className="font-medium" style={{ color: model.accent }}>{model.name}</span>
            <button onClick={() => setMessages([])} className="inline-flex h-9 w-9 items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white" title="Clear local history"><Trash2 size={17} /></button>
          </div>
          <div ref={scrollRef} className="min-h-[50vh] flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-8">
            {messages.length === 0 ? <p className="mx-auto mt-24 max-w-md text-center text-sm leading-7 text-slate-400">Choose a model and start a conversation. Your history stays in this browser only.</p> : null}
            {messages.map((message) => (
              <article key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] whitespace-pre-wrap px-4 py-3 text-sm leading-7 sm:max-w-[70%] ${message.role === "user" ? "bg-teal-700 text-white" : "bg-white/10 text-slate-100"}`}>
                  {message.attachmentName ? <p className="mb-2 text-xs text-teal-200">Attachment: {message.attachmentName}</p> : null}
                  {message.text}
                </div>
              </article>
            ))}
            {loading ? <p className="text-sm text-slate-400">Thinking...</p> : null}
          </div>
          <form onSubmit={send} className="border-t border-white/10 bg-slate-950/60 p-3 sm:p-4">
            {attachment ? <div className="mb-2 flex items-center justify-between bg-white/10 px-3 py-2 text-xs"><span>{attachment.name}</span><button type="button" onClick={() => setAttachment(null)}>Remove</button></div> : null}
            <div className="flex items-end gap-2">
              <input ref={fileRef} type="file" className="hidden" onChange={(event) => selectFile(event.target.files?.[0])} />
              <button type="button" onClick={() => fileRef.current?.click()} className="flex h-11 w-11 shrink-0 items-center justify-center border border-white/15 hover:bg-white/10" title="Attach a file"><FileUp size={18} /></button>
              <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(event); } }} rows={1} placeholder={`Message ${model.name}`} className="max-h-40 min-h-11 flex-1 resize-y bg-white/10 px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-teal-400" />
              <button disabled={loading || (!input.trim() && !attachment)} className="flex h-11 w-11 shrink-0 items-center justify-center text-white disabled:opacity-40" style={{ background: model.accent }} title="Send"><Send size={18} /></button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
