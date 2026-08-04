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
  modelUrl?: string;
  images: Record<PetAction, string>;
  greeting: string;
  systemPrompt: string;
  keywordActions: Record<string, { action: PetAction; response: string; affection: number }>;
  live2d?: { runtime: "cubism4"; modelFormat: "model3"; modelUrl: string; idleGroup: string; talkGroup: string; motions: Record<string, string> };
  rules?: Array<{ id: string; when: Record<string, string | number>; action: PetAction; affection: number }>;
};

import rawProfiles from "./petProfiles.json";

export const petProfiles: PetProfile[] = rawProfiles as PetProfile[];
/*
export const legacyPetProfiles: PetProfile[] = [
  {
    id: "muqiu",
    name: "Muqiu",
    subtitle: "A curious companion who collects tiny wins.",
    accent: "#0f766e",
    background: "/assets/site/background.png",
    avatar: "/assets/pets/muqiu/avatar.png",
    previewImage: "/assets/pets/muqiu/fallback.png",
    transitionGif: "/assets/pets/muqiu/transition.gif",
    images: muqiuImages,
    greeting: "I am here. What shall we explore today?",
    systemPrompt: "You are Muqiu, a warm virtual companion. Be concise, playful, and helpful. Do not claim to have real-world experiences.",
    keywordActions: {
      "谢谢": { action: "happy", response: "You are welcome. I am saving that smile.", affection: 3 },
      "喜欢": { action: "happy", response: "That made my mood meter sparkle.", affection: 4 },
      "难过": { action: "surprised", response: "I am listening. We can take this one small step at a time.", affection: 2 },
      "晚安": { action: "idle", response: "Rest well. I will keep the little lamp on.", affection: 2 },
    },
  },
  {
    id: "yuno",
    name: "Yuno",
    subtitle: "A quiet companion for late-night ideas.",
    accent: "#b45309",
    background: "/assets/site/cover.png",
    avatar: "/assets/pets/muqiu/avatar.png",
    previewImage: "/assets/pets/muqiu/idle.gif",
    transitionGif: "/assets/pets/muqiu/transition.gif",
    images: muqiuImages,
    greeting: "The room is calm. Tell me what is on your mind.",
    systemPrompt: "You are Yuno, a calm virtual companion. Give supportive, practical, concise answers. Do not claim to have real-world experiences.",
    keywordActions: {
      "灵感": { action: "happy", response: "Let us catch it before it wanders off. What is the first sentence?", affection: 3 },
      "焦虑": { action: "surprised", response: "Pause with me. Name the next task that takes less than five minutes.", affection: 2 },
      "晚安": { action: "idle", response: "Good night. Your unfinished ideas can wait safely here.", affection: 2 },
    },
  },
]; */

export function getPetProfile(id: string) {
  return petProfiles.find((profile) => profile.id === id);
}
