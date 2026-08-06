"use client";

import Image from "next/image";
import { resolvePetAssetPath, type PetAction, type PetProfile } from "@/data/petProfiles";
import Live2DStage from "@/components/Live2DStage";

type Props = {
  pet: PetProfile;
  action: PetAction;
  onLive2DReady?: (reactTo?: (text: string) => Promise<void>) => void;
};

export default function PetAvatar({ pet, action, onLive2DReady }: Props) {
  const image = resolvePetAssetPath(pet.images[action] || pet.images.idle);

  return (
    <div className="relative h-full w-full overflow-hidden" aria-label={`${pet.name} avatar`}>
      <Image src={image} alt={pet.name} fill unoptimized className="object-contain drop-shadow-2xl" />
      {pet.live2d?.modelId ? <Live2DStage pet={pet} action={action} onReactToReady={onLive2DReady} /> : null}
    </div>
  );
}
