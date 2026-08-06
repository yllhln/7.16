export type PetAction = "idle" | "thinking" | "happy" | "surprised";

export type PetProfile = {
  id: string;
  name: string;
  subtitle: string;
  accent: string;
  background: string;
  avatar: string;
  previewImage: string;
  transitionGif: string;
  images: Record<PetAction, string>;
  greeting: string;
  systemPrompt: string;
  keywordActions: Record<string, { action: PetAction; response: string; affection: number }>;
  live2d?: { runtime: "cubism4"; modelFormat: "model3"; modelId?: string; modelUrl?: string; idleGroup: string; talkGroup: string; motions: Record<string, string> };
  rules?: Array<{ id: string; when: Record<string, string | number>; action: PetAction; affection: number }>;
};

import rawProfiles from "./petProfiles.json";

export const petProfiles: PetProfile[] = rawProfiles as unknown as PetProfile[];

export function getPetProfile(id: string) {
  return petProfiles.find((profile) => profile.id === id);
}
