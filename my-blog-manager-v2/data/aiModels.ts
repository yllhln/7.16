export type AIModel = {
  id: string;
  provider: "gemini";
  remoteModel: string;
  name: string;
  description: string;
  accent: string;
};

import rawModels from "./aiModels.json";

export const aiModels: AIModel[] = rawModels;

export const defaultAIModelId = aiModels[0].id;

export function getAIModel(id: string) {
  return aiModels.find((model) => model.id === id);
}
