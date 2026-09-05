"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { History, Menu, Plus, Volume2, VolumeX, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { CharacterRuntimeProfile } from "@/lib/characterProfiles";
import { ConversationStore, type Conversation } from "@/lib/session";
import { placeholderForEmotion } from "@/lib/emotionPlaceholder";
import Live2DCanvas from "@/components/Live2DCanvas";
import CharacterSelector from "@/components/CharacterSelector";
import ConversationContext from "@/components/ConversationContext";
import ChatInput, { type ChatAttachment } from "@/components/ChatInput";

type AiWorkspaceProps = {
  profile: CharacterRuntimeProfile;
  characterProfiles: CharacterRuntimeProfile[];
};

function messageId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function localReply(input: string, attachment?: ChatAttachment): { text: string; emotion: string } {
  const source = attachment?.text ? `我也读到了你附上的文字：${attachment.text.slice(0, 120)}` : "";
  const emotion = /谢谢|开心|太好了|喜欢/.test(input) ? "happy" : /难过|伤心|烦/.test(input) ? "sad" : "neutral";
  return {
    emotion,
    text: source || `收到啦！你说的是“${input.slice(0, 100)}”。这是本地演示回复，接入启用的 AI Profile 后会替换为真实回答。`,
  };
}

export default function AiWorkspace({ profile, characterProfiles }: AiWorkspaceProps) {
  const router = useRouter();
  const storeRef = useRef<ConversationStore | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);
  const [conversation, setConversation] = useState<Conversation>();
  const [history, setHistory] = useState<Conversation[]>([]);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<ChatAttachment>();
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [emotion, setEmotion] = useState("neutral");
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const currentPlaceholder = useMemo(() => placeholderForEmotion(emotion), [emotion]);

  useEffect(() => {
    const store = storeRef.current ?? new ConversationStore();
    storeRef.current = store;
    const items = store.list(profile.character.id);
    const current = items[0] ?? store.newConversation(profile.character.id);
    setConversation(current);
    setHistory(store.list(profile.character.id));
    setHydrated(true);
    setDraft("");
    setEmotion("neutral");
    setAttachment((previous) => {
      if (previous?.previewUrl) URL.revokeObjectURL(previous.previewUrl);
      return undefined;
    });
  }, [profile.character.id]);

  useEffect(() => () => {
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
  }, [attachment]);

  const handleNewConversation = () => {
    const store = storeRef.current;
    if (!store) return;
    const next = store.newConversation(profile.character.id);
    setConversation(next);
    setHistory(store.list(profile.character.id));
    setMobileToolsOpen(false);
  };

  const handleDeleteConversation = (id: string) => {
    const store = storeRef.current;
    if (!store || !store.delete(id, profile.character.id)) return;
    const next = store.list(profile.character.id)[0] ?? store.newConversation(profile.character.id);
    setConversation(next);
    setHistory(store.list(profile.character.id));
  };

  const handlePickFile = () => fileRef.current?.click();

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (file.type.startsWith("image/")) {
      const previewUrl = URL.createObjectURL(file);
      setAttachment((previous) => {
        if (previous?.previewUrl) URL.revokeObjectURL(previous.previewUrl);
        return { name: file.name, type: file.type, previewUrl };
      });
      return;
    }
    if (file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt")) {
      setAttachment({ name: file.name, type: "text/plain", text: await file.text() });
      return;
    }
    setAttachment({ name: file.name, type: file.type || "application/octet-stream" });
  };

  const handleSubmit = () => {
    const store = storeRef.current;
    if (!store || !conversation) return;
    const text = draft.trim();
    if (!text && !attachment) return;
    const userText = text || `上传了文件：${attachment?.name ?? "附件"}`;
    const updated = store.appendMessage(conversation.id, profile.character.id, {
      id: messageId(),
      role: "user",
      text: userText,
      attachmentName: attachment?.name,
      attachmentType: attachment?.type,
    });
    if (!updated) return;
    const reply = localReply(text || userText, attachment);
    const withReply = store.appendMessage(conversation.id, profile.character.id, {
      id: messageId(),
      role: "assistant",
      text: reply.text,
    });
    setConversation(withReply ?? updated);
    setHistory(store.list(profile.character.id));
    setDraft("");
    setEmotion(reply.emotion);
    setAttachment((previous) => {
      if (previous?.previewUrl) URL.revokeObjectURL(previous.previewUrl);
      return undefined;
    });
    if (ttsEnabled && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(reply.text));
    }
  };

  const switchCharacter = (id: string) => {
    if (id !== profile.character.id) router.push(`/ai?character=${encodeURIComponent(id)}`);
  };

  return (
    <div className="relative flex min-h-[calc(100svh-4rem)] flex-1 flex-col pt-16 md:pt-16">
      <input ref={fileRef} type="file" accept=".txt,text/plain,image/*" className="hidden" onChange={(event) => { void handleFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
      <div className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col px-3 pb-3 sm:px-5 md:px-8">
        <div className="mb-3 flex items-center justify-between gap-3 md:hidden">
          <div className="min-w-0"><p className="truncate text-sm font-black text-slate-800 dark:text-white">{profile.character.name}</p><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-500">AI companion</p></div>
          <button type="button" aria-label="打开工具" onClick={() => setMobileToolsOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/60 bg-white/60 text-slate-700 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200"><Menu size={19} /></button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[minmax(0,4fr)_minmax(280px,1fr)]">
          <section className="relative flex min-h-[min(66svh,720px)] min-w-0 flex-col overflow-hidden rounded-[30px] border border-white/60 bg-white/30 shadow-2xl backdrop-blur-md dark:border-white/10 dark:bg-slate-900/35 md:min-h-0">
            <div className="absolute left-5 top-5 z-10 hidden items-center gap-2 rounded-2xl border border-white/60 bg-white/60 px-3 py-2 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60 md:flex"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /><span className="text-xs font-black text-slate-700 dark:text-slate-200">{profile.character.name}</span></div>
            <div className="min-h-0 flex-1"><Live2DCanvas modelUrl={profile.live2dModel.publicModelPath} backgroundUrl={profile.background.publicPath} behaviorProfile={profile.behaviorProfile.emotions} emotion={emotion} className="h-full min-h-[min(66svh,720px)] md:min-h-full" /></div>
          </section>
          <div className="hidden min-h-0 md:flex"><ConversationContext conversation={conversation} history={history} onSelect={(id) => { const next = storeRef.current?.get(id, profile.character.id); if (next) setConversation(next); }} onDelete={handleDeleteConversation} /></div>
        </div>

        <div className="mt-3 hidden items-center gap-3 md:flex">
          <button type="button" aria-label="上传文件" onClick={handlePickFile} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/60 bg-white/60 text-slate-600 shadow-sm backdrop-blur-xl transition hover:bg-indigo-500 hover:text-white dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300"><Plus size={19} /></button>
          <button type="button" aria-label="新建对话" onClick={handleNewConversation} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/60 bg-white/60 text-slate-600 shadow-sm backdrop-blur-xl transition hover:bg-indigo-500 hover:text-white dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300"><History size={18} /></button>
          <div className="min-w-0 flex-1"><ChatInput placeholder={currentPlaceholder} value={draft} attachment={attachment} disabled={!hydrated} onChange={setDraft} onSubmit={handleSubmit} onPickFile={handlePickFile} onRemoveAttachment={() => setAttachment(undefined)} /></div>
          <CharacterSelector profiles={characterProfiles} selectedId={profile.character.id} onChange={switchCharacter} />
          <button type="button" aria-label={ttsEnabled ? "关闭语音" : "开启语音"} onClick={() => setTtsEnabled((value) => !value)} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-sm transition ${ttsEnabled ? "border-indigo-400 bg-indigo-500 text-white" : "border-white/60 bg-white/60 text-slate-600 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300"}`}>{ttsEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
        </div>
        <div className="mt-3 md:hidden"><ChatInput placeholder={currentPlaceholder} value={draft} attachment={attachment} disabled={!hydrated} onChange={setDraft} onSubmit={handleSubmit} onPickFile={handlePickFile} onRemoveAttachment={() => setAttachment(undefined)} /></div>
      </div>

      {mobileToolsOpen ? <div className="fixed inset-0 z-[80] md:hidden"><button type="button" aria-label="关闭工具" onClick={() => setMobileToolsOpen(false)} className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" /><div className="absolute inset-x-3 bottom-3 max-h-[80svh] overflow-y-auto rounded-[28px] border border-white/60 bg-white/90 p-4 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/95"><div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">Tools</p><h2 className="text-lg font-black text-slate-800 dark:text-white">陪伴设置</h2></div><button type="button" aria-label="关闭" onClick={() => setMobileToolsOpen(false)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button></div><div className="space-y-3"><CharacterSelector profiles={characterProfiles} selectedId={profile.character.id} onChange={switchCharacter} /><button type="button" onClick={() => setTtsEnabled((value) => !value)} className="flex w-full items-center justify-between rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm font-bold text-slate-700 dark:border-white/10 dark:bg-slate-800/70 dark:text-slate-200"><span className="flex items-center gap-2">{ttsEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />} TTS 语音</span><span className="text-xs text-indigo-500">{ttsEnabled ? "已开启" : "已关闭"}</span></button><button type="button" onClick={handleNewConversation} className="flex w-full items-center gap-2 rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm font-bold text-slate-700 dark:border-white/10 dark:bg-slate-800/70 dark:text-slate-200"><Plus size={17} /> 新建对话</button><button type="button" onClick={handlePickFile} className="flex w-full items-center gap-2 rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm font-bold text-slate-700 dark:border-white/10 dark:bg-slate-800/70 dark:text-slate-200"><History size={17} /> 上传 TXT / 图片</button><div className="h-72 min-h-0"><ConversationContext conversation={conversation} history={history} onSelect={(id) => { const next = storeRef.current?.get(id, profile.character.id); if (next) setConversation(next); setMobileToolsOpen(false); }} onDelete={handleDeleteConversation} /></div></div></div></div> : null}
    </div>
  );
}
