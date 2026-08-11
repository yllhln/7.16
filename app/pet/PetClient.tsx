"use client";

import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, FileUp, Heart, Send, Volume2, VolumeX } from "lucide-react";
import Navbar from "@/components/Navbar";
import PetAvatar from "@/components/PetAvatar";
import { getPetProfile, petProfiles, resolvePetAssetPath, type PetAction, type PetProfile } from "@/data/petProfiles";
import { loadLocal, saveLocal, type StoredMessage } from "@/lib/localChat";
import { evaluateInteraction } from "@/lib/interactionRules";
import { speakText, stopSpeaking } from "@/lib/tts";

type Attachment = { name: string; text?: string; base64?: string; mimeType?: string };
const moodKey = (id: string) => `pet-mood:${id}`;

export default function PetClient() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [entering, setEntering] = useState<string | null>(null);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [affection, setAffection] = useState(0);
  const [action, setAction] = useState<PetAction>("idle");
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [loading, setLoading] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const live2dReactRef = useRef<((text: string) => Promise<void>) | undefined>(undefined);
  const pet = selectedId ? getPetProfile(selectedId) : undefined;

  useEffect(() => {
    if (!pet) return;
    const history = loadLocal<StoredMessage[]>("pet-history", pet.id, []);
    setMessages(history.length ? history : [{ id: crypto.randomUUID(), role: "assistant", text: pet.greeting }]);
    setAffection(loadLocal(moodKey(pet.id), "value", 0));
    setAction("idle");
  }, [pet]);

  useEffect(() => {
    if (!pet) return;
    saveLocal("pet-history", pet.id, messages);
    saveLocal(moodKey(pet.id), "value", affection);
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [affection, messages, pet, loading]);

  useEffect(() => {
    setTtsEnabled(loadLocal("pet-tts", "enabled", false));
  }, []);

  useEffect(() => {
    saveLocal("pet-tts", "enabled", ttsEnabled);
    if (!ttsEnabled) stopSpeaking();
  }, [ttsEnabled]);

  const choosePet = (profile: PetProfile) => {
    setEntering(profile.id);
    window.setTimeout(() => {
      setSelectedId(profile.id);
      setEntering(null);
    }, 900);
  };

  const selectFile = (file?: File) => {
    if (!file) return;
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => { const value = String(reader.result || ""); setAttachment({ name: file.name, base64: value.split(",")[1], mimeType: file.type }); };
      reader.readAsDataURL(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAttachment({ name: file.name, text: String(reader.result || "") });
    reader.readAsText(file);
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!pet) return;
    const text = input.trim();
    if ((!text && !attachment) || loading) return;
    const trigger = evaluateInteraction(pet, { input: text, affection });
    const requestAttachment = attachment;
    const message = requestAttachment?.text ? `${text}\n\n[Attachment: ${requestAttachment.name}]\n${requestAttachment.text}` : text;
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: text || "Attachment sent", attachmentName: requestAttachment?.name }]);
    setInput("");
    setAttachment(null);
    setAction(trigger.action);
    setLoading(true);
    void live2dReactRef.current?.(text);
    try {
      const response = await fetch("/api/pet-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modelId: "gemini-flash-lite", message: message || "Please inspect the attached image.", systemPrompt: pet.systemPrompt, fileBase64: requestAttachment?.base64, fileMimeType: requestAttachment?.mimeType }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Request failed");
      const reply = trigger.response ? `${trigger.response}\n\n${data.reply}` : data.reply;
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: reply }]);
      setAffection((value) => Math.min(100, value + trigger.affection));
      setAction(evaluateInteraction(pet, { input: text, reply: data.reply, affection: affection + trigger.affection }).action);
      void live2dReactRef.current?.(data.reply);
      void speakText(reply, ttsEnabled);
    } catch (error) {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: `I could not answer just now: ${error instanceof Error ? error.message : "Unknown error"}` }]);
      setAction("surprised");
    } finally {
      setLoading(false);
      window.setTimeout(() => setAction("idle"), 2400);
    }
  };

  if (!pet) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <Navbar />
        <section className="mx-auto max-w-6xl px-5 pb-12 pt-28">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">AI pets</p>
          <h1 className="mt-2 text-3xl font-bold">Choose a companion</h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-400">Each profile owns its local history, affection score, background, keyword reactions, and animation set.</p>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {petProfiles.map((profile) => (
              <button key={profile.id} onClick={() => choosePet(profile)} className="group relative grid min-h-72 overflow-hidden border border-white/10 bg-white/5 text-left transition hover:border-white/35 hover:bg-white/10 md:grid-cols-[0.9fr_1.1fr]">
                <div className="relative min-h-44" style={{ background: `linear-gradient(135deg, ${profile.accent}55, transparent)` }}><PetAvatar pet={profile} action="idle" /></div>
                <div className="flex flex-col justify-end p-6"><span className="text-xs uppercase tracking-[0.16em]" style={{ color: profile.accent }}>Open chat</span><strong className="mt-2 text-2xl">{profile.name}</strong><span className="mt-2 text-sm leading-6 text-slate-400">{profile.subtitle}</span></div>
                {entering === profile.id ? <Image src={resolvePetAssetPath(profile.transitionGif)} alt="" fill unoptimized className="object-cover" /> : null}
              </button>
            ))}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100" style={{ backgroundImage: `linear-gradient(90deg, rgba(2,6,23,.96), rgba(2,6,23,.78)), url(${resolvePetAssetPath(pet.background)})`, backgroundSize: "cover", backgroundPosition: "center" }}>
      <Navbar />
      <section className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-5 pt-24 sm:px-8">
        <header className="mb-3 flex items-center justify-between border-b border-white/10 pb-3"><button onClick={() => setSelectedId(null)} className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"><ArrowLeft size={16} /> Pets</button><div className="flex items-center gap-2"><button onClick={() => setTtsEnabled((value) => !value)} className="inline-flex h-9 w-9 items-center justify-center text-slate-300 hover:bg-white/10 hover:text-white" title={ttsEnabled ? "Disable voice" : "Enable voice"}>{ttsEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}</button><div className="flex items-center gap-2 text-sm" style={{ color: pet.accent }}><Heart size={16} fill="currentColor" /> {affection}/100</div></div></header>
        <div className="grid min-h-0 flex-1 overflow-hidden border border-white/10 bg-slate-950/70 lg:grid-cols-[minmax(260px,.8fr)_minmax(0,1.4fr)]">
          <aside className="relative min-h-64 border-b border-white/10 lg:border-b-0 lg:border-r"><div className="absolute inset-0 opacity-20" style={{ background: pet.accent }} /><div className="relative mx-auto h-72 max-w-sm lg:h-full"><PetAvatar pet={pet} action={action} onLive2DReady={(reactTo) => { live2dReactRef.current = reactTo; }} /></div><div className="absolute bottom-4 left-5"><p className="text-xl font-bold">{pet.name}</p><p className="text-sm text-slate-300">{action}</p></div></aside>
          <div className="flex min-h-[60vh] flex-col">
            <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-8">{messages.map((message) => <article key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] whitespace-pre-wrap px-4 py-3 text-sm leading-7 sm:max-w-[72%] ${message.role === "user" ? "text-white" : "bg-white/10"}`} style={message.role === "user" ? { background: pet.accent } : undefined}>{message.attachmentName ? <p className="mb-2 text-xs opacity-75">Attachment: {message.attachmentName}</p> : null}{message.text}</div></article>)}{loading ? <p className="text-sm text-slate-400">{pet.name} is reacting...</p> : null}</div>
            <form onSubmit={send} className="border-t border-white/10 p-3 sm:p-4">{attachment ? <div className="mb-2 flex justify-between bg-white/10 px-3 py-2 text-xs"><span>{attachment.name}</span><button type="button" onClick={() => setAttachment(null)}>Remove</button></div> : null}<div className="flex items-end gap-2"><input ref={fileRef} type="file" className="hidden" onChange={(event) => selectFile(event.target.files?.[0])} /><button type="button" onClick={() => fileRef.current?.click()} title="Attach a file" className="flex h-11 w-11 shrink-0 items-center justify-center border border-white/15 hover:bg-white/10"><FileUp size={18} /></button><textarea value={input} onChange={(event) => setInput(event.target.value)} rows={1} placeholder={`Talk to ${pet.name}`} className="min-h-11 flex-1 resize-y bg-white/10 px-3 py-2.5 text-sm outline-none focus:ring-1" /><button disabled={loading || (!input.trim() && !attachment)} title="Send" className="flex h-11 w-11 shrink-0 items-center justify-center disabled:opacity-40" style={{ background: pet.accent }}><Send size={18} /></button></div></form>
          </div>
        </div>
      </section>
    </main>
  );
}
