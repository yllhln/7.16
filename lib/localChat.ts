export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  attachmentName?: string;
};

export interface PersistenceAdapter {
  read<T>(key: string, fallback: T): T;
  write<T>(key: string, value: T): void;
  remove(key: string): void;
}

export class LocalStoragePersistenceAdapter implements PersistenceAdapter {
  constructor(private readonly namespace = "xhblogs") {}

  read<T>(key: string, fallback: T): T {
    if (typeof window === "undefined") return fallback;
    try {
      const raw = window.localStorage.getItem(this.storageKey(key));
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  write<T>(key: string, value: T): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(this.storageKey(key), JSON.stringify(value));
    } catch {
      // Local storage can be unavailable in private browsing or full quotas.
    }
  }

  remove(key: string): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(this.storageKey(key));
    } catch {
      // Ignore storage failures so the chat page remains usable.
    }
  }

  private storageKey(key: string): string {
    return `${this.namespace}:${key}`;
  }
}

export class MemoryPersistenceAdapter implements PersistenceAdapter {
  private readonly values = new Map<string, unknown>();

  read<T>(key: string, fallback: T): T {
    return this.values.has(key) ? (this.values.get(key) as T) : fallback;
  }

  write<T>(key: string, value: T): void {
    this.values.set(key, value);
  }

  remove(key: string): void {
    this.values.delete(key);
  }
}

const defaultPersistence = new LocalStoragePersistenceAdapter();
const key = (scope: string, id: string) => `${scope}:${id}`;

export function loadLocal<T>(scope: string, id: string, fallback: T): T {
  return defaultPersistence.read(key(scope, id), fallback);
}

export function saveLocal<T>(scope: string, id: string, value: T) {
  defaultPersistence.write(key(scope, id), value);
}
