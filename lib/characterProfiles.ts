import aiProfilesData from "@/data/ai_profiles.json";
import backgroundsData from "@/data/backgrounds.json";
import behaviorProfilesData from "@/data/behavior_profiles.json";
import charactersData from "@/data/characters.json";
import live2dModelsData from "@/data/live2d_models.json";
import ttsProfilesData from "@/data/tts_profiles.json";

export type CharacterEmotionAction = {
  expression?: string | null;
  motion?: string | null;
};

export type BehaviorProfile = {
  id: string;
  displayName: string;
  emotions: Record<string, CharacterEmotionAction>;
};

export type AIModelProfile = {
  id: string;
  displayName: string;
  adapter: "openai-compatible" | "gemini" | string;
  baseUrl: string;
  baseUrlEnv?: string;
  apiKeyEnv?: string;
  modelId: string;
  enabled: boolean;
  parameters: Record<string, unknown>;
};

export type TTSProfile = {
  id: string;
  displayName: string;
  adapter: "openai-compatible" | "volcengine" | string;
  apiUrl: string;
  apiUrlEnv?: string;
  apiKeyEnv?: string;
  modelIdEnv?: string;
  voiceId: string;
  voiceIdEnv?: string;
  enabled: boolean;
  parameters: Record<string, unknown>;
};

export type BackgroundProfile = {
  id: string;
  displayName: string;
  publicPath: string;
  enabled: boolean;
};

export type Live2DModelProfile = {
  id: string;
  displayName: string;
  format: string;
  publicModelPath: string;
  mappingPath?: string;
  status?: string;
};

export type CharacterProfile = {
  id: string;
  name: string;
  live2dModelId: string;
  backgroundId: string;
  aiProfileId: string;
  ttsProfileId: string;
  behaviorProfileId: string;
  systemPrompt: string;
  enabled: boolean;
};

export type CharacterRuntimeProfile = {
  character: CharacterProfile;
  live2dModel: Live2DModelProfile;
  background: BackgroundProfile;
  aiProfile: AIModelProfile;
  ttsProfile: TTSProfile;
  behaviorProfile: BehaviorProfile;
};

type DataEnvelope<T> = {
  schemaVersion: number;
  profiles?: T[];
  backgrounds?: T[];
  characters?: T[];
  models?: T[];
};

const aiProfiles = (aiProfilesData as DataEnvelope<AIModelProfile>).profiles ?? [];
const ttsProfiles = (ttsProfilesData as DataEnvelope<TTSProfile>).profiles ?? [];
const behaviorProfiles = (behaviorProfilesData as unknown as DataEnvelope<BehaviorProfile>).profiles ?? [];
const backgrounds = (backgroundsData as DataEnvelope<BackgroundProfile>).backgrounds ?? [];
const characters = (charactersData as DataEnvelope<CharacterProfile>).characters ?? [];
const live2dModels = (live2dModelsData as DataEnvelope<Live2DModelProfile>).models ?? [];

function byId<T extends { id: string }>(items: T[], id: string, label: string): T {
  const item = items.find((entry) => entry.id === id);
  if (!item) throw new Error(`Character configuration references missing ${label}: ${id}`);
  return item;
}

export function listCharacters(): CharacterProfile[] {
  return characters.slice();
}

export function listEnabledCharacters(): CharacterProfile[] {
  return characters.filter((character) => character.enabled);
}

export function getDefaultCharacter(): CharacterProfile {
  return listEnabledCharacters()[0] ?? characters[0] ?? (() => {
    throw new Error("No AI character profile is configured.");
  })();
}

export function getCharacterProfile(characterId?: string): CharacterProfile {
  if (!characterId) return getDefaultCharacter();
  const requested = characters.find((character) => character.id === characterId);
  return requested ?? getDefaultCharacter();
}

export function resolveCharacterRuntimeProfile(characterId?: string): CharacterRuntimeProfile {
  const character = getCharacterProfile(characterId);
  return {
    character,
    live2dModel: byId(live2dModels, character.live2dModelId, "Live2D model"),
    background: byId(backgrounds, character.backgroundId, "background"),
    aiProfile: byId(aiProfiles, character.aiProfileId, "AI profile"),
    ttsProfile: byId(ttsProfiles, character.ttsProfileId, "TTS profile"),
    behaviorProfile: byId(behaviorProfiles, character.behaviorProfileId, "behavior profile"),
  };
}
