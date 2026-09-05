"use client";

import { FileText, Image as ImageIcon, Paperclip, Send, X } from "lucide-react";

export type ChatAttachment = {
  name: string;
  type: string;
  previewUrl?: string;
  text?: string;
};

type ChatInputProps = {
  placeholder: string;
  value: string;
  attachment?: ChatAttachment;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onPickFile: () => void;
  onRemoveAttachment: () => void;
};

export default function ChatInput({
  placeholder,
  value,
  attachment,
  disabled = false,
  onChange,
  onSubmit,
  onPickFile,
  onRemoveAttachment,
}: ChatInputProps) {
  return (
    <div className="rounded-[24px] border border-white/60 bg-white/65 p-2 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70 sm:p-3">
      {attachment ? (
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-indigo-200/70 bg-indigo-50/70 px-3 py-2 text-xs text-indigo-700 dark:border-indigo-400/20 dark:bg-indigo-500/10 dark:text-indigo-200">
          {attachment.type.startsWith("image/") ? <ImageIcon size={15} /> : <FileText size={15} />}
          <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
          <button type="button" aria-label="移除附件" onClick={onRemoveAttachment} className="rounded-full p-1 hover:bg-white/80 dark:hover:bg-slate-700">
            <X size={14} />
          </button>
        </div>
      ) : null}
      <div className="flex items-end gap-2">
        <button type="button" aria-label="上传文件" onClick={onPickFile} disabled={disabled} className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-slate-600 shadow-sm transition hover:bg-indigo-500 hover:text-white disabled:opacity-50 dark:bg-slate-800/80 dark:text-slate-300 sm:flex">
          <Paperclip size={18} />
        </button>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="min-h-11 max-h-28 flex-1 resize-none bg-transparent px-2 py-3 text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed dark:text-slate-100 dark:placeholder:text-slate-500"
        />
        <button type="button" aria-label="发送消息" onClick={onSubmit} disabled={disabled || (!value.trim() && !attachment)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-40">
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

