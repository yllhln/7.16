export type AIModel = {
  id: string;
  provider: "gemini" | "openai-compatible";
  remoteModel: string;
  baseUrl?: string;
  apiKeyEnv?: string;
  name: string;
  description: string;
  accent: string;
  enabled?: boolean;
};

import rawModels from "./aiModels.json";

export const aiModels = rawModels as AIModel[];

export const enabledAIModels = aiModels.filter((model) => model.enabled !== false);

export const defaultAIModelId = enabledAIModels[0]?.id || "";

export function getAIModel(id: string) {
  return aiModels.find((model) => model.id === id && model.enabled !== false);
}
