"use client";

import Image from "next/image";
import type { PetAction, PetProfile } from "@/data/petProfiles";
import Live2DStage from "@/components/Live2DStage";

type Props = {
  pet: PetProfile;
  action: PetAction;
};

export default function PetAvatar({ pet, action }: Props) {
  // modelUrl is reserved for a local Cubism model. Until a licensed .model3.json
  // bundle is added, the local animated fallback keeps the interaction usable.
  const image = pet.images[action] || pet.images.idle;

  return (
    <div className="relative h-full w-full overflow-hidden" aria-label={`${pet.name} avatar`}>
      <Image src={image} alt={pet.name} fill unoptimized className="object-contain drop-shadow-2xl" />
      {pet.live2d?.modelUrl ? <Live2DStage pet={pet} action={action} /> : null}
    </div>
  );
}
