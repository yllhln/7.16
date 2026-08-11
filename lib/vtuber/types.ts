export type VtuberRole = "user" | "assistant";

export type VtuberMessage = {
  id: string;
  role: VtuberRole;
  text: string;
  createdAt: number;
  attachmentName?: string;
};

export type VtuberSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: VtuberMessage[];
};

export type CloudChatMessage = Pick<VtuberMessage, "role" | "text">;

export type ImageAttachment = {
  name: string;
  base64: string;
  mimeType: string;
};
