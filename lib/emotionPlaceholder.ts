export const DEFAULT_CHAT_PLACEHOLDER = "快来提问叭(≧∀≦)ゞ";

const EMOTION_PLACEHOLDERS: Record<string, string> = {
  neutral: DEFAULT_CHAT_PLACEHOLDER,
  happy: "今天想聊点开心的吗？",
  excited: "有什么新鲜事要分享？",
  sad: "我在这里，慢慢说吧…",
  angry: "先深呼吸，我们慢慢聊。",
  surprised: "发生什么啦？",
  embarrassed: "不用害羞，尽管问我。",
  confused: "要不要一起理清思路？",
};

function limitPlaceholder(value: string): string {
  const characters = Array.from(value.trim());
  if (characters.length <= 16) return characters.join("");
  return `${characters.slice(0, 15).join("")}…`;
}

export function placeholderForEmotion(emotion: unknown): string {
  if (typeof emotion !== "string") return DEFAULT_CHAT_PLACEHOLDER;
  const key = emotion.trim().toLowerCase();
  const placeholder = EMOTION_PLACEHOLDERS[key];
  if (!placeholder) return DEFAULT_CHAT_PLACEHOLDER;
  const limited = limitPlaceholder(placeholder);
  return limited || DEFAULT_CHAT_PLACEHOLDER;
}

