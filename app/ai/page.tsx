import { resolveCharacterRuntimeProfile } from "@/lib/characterProfiles";
import { listEnabledCharacters } from "@/lib/characterProfiles";
import Navbar from "@/components/Navbar";
import AiWorkspace from "@/components/AiWorkspace";

export default async function AiPage({
  searchParams,
}: {
  searchParams: Promise<{ character?: string | string[] }>;
}) {
  const query = await searchParams;
  const requestedCharacter = Array.isArray(query.character) ? query.character[0] : query.character;
  const profile = resolveCharacterRuntimeProfile(requestedCharacter);
  const characterProfiles = listEnabledCharacters().map((character) => resolveCharacterRuntimeProfile(character.id));

  return (
    <main data-character-id={profile.character.id} data-ai-profile-id={profile.aiProfile.id} data-tts-profile-id={profile.ttsProfile.id} data-behavior-profile-id={profile.behaviorProfile.id} data-system-prompt={profile.character.systemPrompt} className="min-h-screen">
      <Navbar />
      <AiWorkspace profile={profile} characterProfiles={characterProfiles} />
    </main>
  );
}
