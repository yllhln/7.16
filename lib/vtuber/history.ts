import { vtuberConfig } from "@/data/vtuberConfig";
import type { VtuberSession } from "./types";

const STORAGE_KEY = "xhblogs:vtuber:sessions";

export function createVtuberSession(): VtuberSession {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: "新对话",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

export function loadVtuberSessions() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is VtuberSession => {
      if (!item || typeof item !== "object") return false;
      const value = item as Partial<VtuberSession>;
      return typeof value.id === "string" && typeof value.title === "string" && Array.isArray(value.messages);
    }).slice(0, vtuberConfig.maxStoredSessions);
  } catch {
    return [];
  }
}

export function saveVtuberSessions(sessions: VtuberSession[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, vtuberConfig.maxStoredSessions)));
  } catch {
    // History remains available for the current tab when storage is unavailable.
  }
}

export function titleFromMessage(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > 22 ? `${compact.slice(0, 22)}...` : compact || "新对话";
}
