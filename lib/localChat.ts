export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  attachmentName?: string;
};

const key = (scope: string, id: string) => `xhblogs:${scope}:${id}`;

export function loadLocal<T>(scope: string, id: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key(scope, id));
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveLocal<T>(scope: string, id: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key(scope, id), JSON.stringify(value));
  } catch {
    // Local storage can be unavailable in private browsing or full quotas.
  }
}
