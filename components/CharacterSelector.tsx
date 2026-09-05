"use client";

import { ChevronDown, Sparkles } from "lucide-react";
import type { CharacterRuntimeProfile } from "@/lib/characterProfiles";

type CharacterSelectorProps = {
  profiles: CharacterRuntimeProfile[];
  selectedId: string;
  onChange: (id: string) => void;
};

export default function CharacterSelector({ profiles, selectedId, onChange }: CharacterSelectorProps) {
  const selected = profiles.find((profile) => profile.character.id === selectedId) ?? profiles[0];
  return (
    <label className="relative flex min-w-0 items-center gap-2 rounded-2xl border border-white/60 bg-white/60 px-3 py-2 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60">
      <Sparkles size={15} className="shrink-0 text-indigo-500" />
      <select value={selected?.character.id ?? ""} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 appearance-none bg-transparent pr-5 text-xs font-bold text-slate-700 outline-none dark:text-slate-200">
        {profiles.map((profile) => <option key={profile.character.id} value={profile.character.id}>{profile.character.name}</option>)}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-3 text-slate-400" />
    </label>
  );
}
