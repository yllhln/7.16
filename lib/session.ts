import {
  LocalStoragePersistenceAdapter,
  type PersistenceAdapter,
  type StoredMessage,
} from "@/lib/localChat";

export const SESSION_SCHEMA_VERSION = 1;
const SESSION_STORAGE_KEY = "session:v1";

export type ConversationMessage = StoredMessage & {
  createdAt: number;
  attachmentType?: string;
};

export type Conversation = {
  id: string;
  characterId: string;
  title: string;
  messages: ConversationMessage[];
  createdAt: number;
  updatedAt: number;
};

type PersistedSession = {
  version: typeof SESSION_SCHEMA_VERSION;
  conversations: Conversation[];
};

export interface ConversationCreateOptions {
  title?: string;
  now?: number;
}

export interface ConversationStoreOptions {
  persistence?: PersistenceAdapter;
  idFactory?: () => string;
  clock?: () => number;
}

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `conversation-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function cloneConversation(conversation: Conversation): Conversation {
  return {
    ...conversation,
    messages: conversation.messages.map((message) => ({ ...message })),
  };
}

function normalizeMessage(value: unknown): ConversationMessage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const message = value as Partial<ConversationMessage>;
  if (
    typeof message.id !== "string"
    || (message.role !== "user" && message.role !== "assistant")
    || typeof message.text !== "string"
  ) {
    return undefined;
  }
  return {
    id: message.id,
    role: message.role,
    text: message.text,
    createdAt: typeof message.createdAt === "number" ? message.createdAt : Date.now(),
    ...(typeof message.attachmentName === "string" ? { attachmentName: message.attachmentName } : {}),
    ...(typeof message.attachmentType === "string" ? { attachmentType: message.attachmentType } : {}),
  };
}

function normalizeConversation(value: unknown): Conversation | undefined {
  if (!value || typeof value !== "object") return undefined;
  const conversation = value as Partial<Conversation>;
  if (
    typeof conversation.id !== "string"
    || typeof conversation.characterId !== "string"
  ) {
    return undefined;
  }
  const messages = Array.isArray(conversation.messages)
    ? conversation.messages.flatMap((message) => {
      const normalized = normalizeMessage(message);
      return normalized ? [normalized] : [];
    })
    : [];
  const createdAt = typeof conversation.createdAt === "number" ? conversation.createdAt : Date.now();
  return {
    id: conversation.id,
    characterId: conversation.characterId,
    title: typeof conversation.title === "string" && conversation.title.trim()
      ? conversation.title
      : "新对话",
    messages,
    createdAt,
    updatedAt: typeof conversation.updatedAt === "number" ? conversation.updatedAt : createdAt,
  };
}

export class ConversationStore {
  private readonly persistence: PersistenceAdapter;
  private readonly idFactory: () => string;
  private readonly clock: () => number;

  constructor(options: ConversationStoreOptions = {}) {
    this.persistence = options.persistence ?? new LocalStoragePersistenceAdapter();
    this.idFactory = options.idFactory ?? createId;
    this.clock = options.clock ?? (() => Date.now());
  }

  list(characterId?: string): Conversation[] {
    const conversations = this.readSession().conversations
      .filter((conversation) => !characterId || conversation.characterId === characterId)
      .sort((left, right) => right.updatedAt - left.updatedAt);
    return conversations.map(cloneConversation);
  }

  get(conversationId: string, characterId?: string): Conversation | undefined {
    const conversation = this.readSession().conversations.find((entry) => (
      entry.id === conversationId && (!characterId || entry.characterId === characterId)
    ));
    return conversation ? cloneConversation(conversation) : undefined;
  }

  newConversation(characterId: string, options: ConversationCreateOptions = {}): Conversation {
    const now = options.now ?? this.clock();
    const conversation: Conversation = {
      id: this.idFactory(),
      characterId,
      title: options.title?.trim() || "新对话",
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    const session = this.readSession();
    session.conversations.push(conversation);
    this.writeSession(session);
    return cloneConversation(conversation);
  }

  appendMessage(
    conversationId: string,
    characterId: string,
    message: Omit<ConversationMessage, "createdAt"> & { createdAt?: number },
  ): Conversation | undefined {
    const session = this.readSession();
    const conversation = session.conversations.find((entry) => (
      entry.id === conversationId && entry.characterId === characterId
    ));
    if (!conversation) return undefined;
    if (
      !message.id
      || (message.role !== "user" && message.role !== "assistant")
      || typeof message.text !== "string"
    ) {
      return undefined;
    }

    const createdAt = message.createdAt ?? this.clock();
    conversation.messages.push({ ...message, createdAt });
    conversation.updatedAt = createdAt;
    if (conversation.title === "新对话" && message.role === "user" && message.text.trim()) {
      conversation.title = message.text.trim().slice(0, 40);
    }
    this.writeSession(session);
    return cloneConversation(conversation);
  }

  delete(conversationId: string, characterId?: string): boolean {
    const session = this.readSession();
    const index = session.conversations.findIndex((entry) => (
      entry.id === conversationId && (!characterId || entry.characterId === characterId)
    ));
    if (index < 0) return false;
    session.conversations.splice(index, 1);
    this.writeSession(session);
    return true;
  }

  clearCharacterHistory(characterId: string): number {
    const session = this.readSession();
    const previousLength = session.conversations.length;
    session.conversations = session.conversations.filter((entry) => entry.characterId !== characterId);
    if (session.conversations.length !== previousLength) this.writeSession(session);
    return previousLength - session.conversations.length;
  }

  private readSession(): PersistedSession {
    const stored = this.persistence.read<unknown>(SESSION_STORAGE_KEY, undefined);
    if (!stored || typeof stored !== "object") {
      return { version: SESSION_SCHEMA_VERSION, conversations: [] };
    }
    const candidate = stored as Partial<PersistedSession>;
    if (candidate.version !== SESSION_SCHEMA_VERSION || !Array.isArray(candidate.conversations)) {
      return { version: SESSION_SCHEMA_VERSION, conversations: [] };
    }
    return {
      version: SESSION_SCHEMA_VERSION,
      conversations: candidate.conversations.flatMap((conversation) => {
        const normalized = normalizeConversation(conversation);
        return normalized ? [normalized] : [];
      }),
    };
  }

  private writeSession(session: PersistedSession): void {
    this.persistence.write(SESSION_STORAGE_KEY, {
      version: SESSION_SCHEMA_VERSION,
      conversations: session.conversations,
    } satisfies PersistedSession);
  }
}
