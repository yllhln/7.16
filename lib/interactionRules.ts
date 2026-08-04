import type { PetAction, PetProfile } from "@/data/petProfiles";

export type InteractionContext = {
  input: string;
  reply?: string;
  affection: number;
  speechRate?: number;
  now?: Date;
};

const positive = ["谢谢", "喜欢", "开心", "好棒", "太好了", "成功", "灵感", "感谢"];
const negative = ["难过", "焦虑", "生气", "失败", "累", "害怕", "崩溃"];

export function evaluateInteraction(profile: PetProfile, context: InteractionContext) {
  const source = `${context.input} ${context.reply || ""}`;
  const direct = Object.entries(profile.keywordActions).find(([keyword]) => source.includes(keyword));
  if (direct) return { action: direct[1].action, affection: direct[1].affection, response: direct[1].response, reason: `keyword:${direct[0]}` };

  const hour = (context.now || new Date()).getHours();
  const semantic = positive.some((word) => source.includes(word)) ? "positive" : negative.some((word) => source.includes(word)) ? "negative" : "neutral";
  const rules = profile.rules || [];
  const matched = rules.find((rule) => {
    const when = rule.when;
    if (when.time === "night" && !(hour >= 22 || hour < 6)) return false;
    if (when.time === "day" && (hour >= 22 || hour < 6)) return false;
    if (typeof when.minLength === "number" && context.input.length < when.minLength) return false;
    if (when.semantic && when.semantic !== semantic) return false;
    if (typeof when.minAffection === "number" && context.affection < when.minAffection) return false;
    if (typeof when.maxSpeechRate === "number" && (context.speechRate || 0) > when.maxSpeechRate) return false;
    return true;
  });
  return matched ? { action: matched.action as PetAction, affection: matched.affection, response: "", reason: matched.id } : { action: semantic === "negative" ? "surprised" : "thinking" as PetAction, affection: 1, response: "", reason: `semantic:${semantic}` };
}
