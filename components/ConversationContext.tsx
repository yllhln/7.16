"use client";

import { Clock3, MessageCircle, Trash2 } from "lucide-react";
import type { Conversation } from "@/lib/session";

type ConversationContextProps = {
  conversation?: Conversation;
  history: Conversation[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
};

function timeLabel(timestamp: number): string {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(timestamp);
}

export default function ConversationContext({ conversation, history, onSelect, onDelete }: ConversationContextProps) {
  return (
    <aside className="flex min-h-0 flex-1 flex-col rounded-[28px] border border-white/60 bg-white/55 p-4 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">Conversation Context</p>
          <h2 className="mt-1 text-base font-black text-slate-800 dark:text-white">用户聊天上下文</h2>
        </div>
        <MessageCircle size={19} className="text-indigo-400" />
      </div>
      <div className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {conversation?.messages.length ? conversation.messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${message.role === "user" ? "rounded-br-md bg-indigo-500 text-white" : "rounded-bl-md bg-white/80 text-slate-700 dark:bg-slate-800/80 dark:text-slate-200"}`}>
              <div>{message.text}</div>
              <div className={`mt-1 flex items-center gap-1 text-[10px] ${message.role === "user" ? "text-white/70" : "text-slate-400"}`}><Clock3 size={10} /> {timeLabel(message.createdAt)}</div>
            </div>
          </div>
        )) : <div className="flex h-full min-h-32 items-center justify-center text-center text-xs font-medium text-slate-400">还没有消息，先和角色打个招呼吧。</div>}
      </div>
      <div className="mt-4 border-t border-white/50 pt-3 dark:border-white/10">
        <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.18em] text-slate-400"><span>History</span><span>{history.length}</span></div>
        <div className="custom-scrollbar flex max-h-24 flex-col gap-1 overflow-y-auto">
          {history.map((entry) => (
            <div key={entry.id} className={`group flex items-center gap-2 rounded-xl px-2 py-1.5 text-xs ${entry.id === conversation?.id ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" : "text-slate-500 hover:bg-white/60 dark:text-slate-400 dark:hover:bg-slate-800/70"}`}>
              <button type="button" onClick={() => onSelect(entry.id)} className="min-w-0 flex-1 truncate text-left">{entry.title}</button>
              <button type="button" aria-label={`删除${entry.title}`} onClick={() => onDelete(entry.id)} className="rounded-md p-1 opacity-60 hover:bg-red-500/10 hover:text-red-500"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

