"use client";

import { useEffect } from "react";
import type { PetAction, PetProfile } from "@/data/petProfiles";
import { getLive2DModel } from "@/data/live2dModels";
import { useLive2DExpression } from "@/hooks/useLive2DExpression";

type Live2DReactTo = (text: string) => Promise<void>;

type Props = {
  pet: PetProfile;
  action: PetAction;
  onReactToReady?: (reactTo?: Live2DReactTo) => void;
};

export default function Live2DStage({ pet, action, onReactToReady }: Props) {
  const definition = getLive2DModel(pet.live2d?.modelId);
  const { canvasRef, ready, error, reactTo, applyExpression, playMotion } = useLive2DExpression(definition);

  useEffect(() => {
    if (!ready || !definition) return;
    const preset = definition.presets[action] || definition.presets.idle;
    if (preset) applyExpression(preset);
    const motionGroup = pet.live2d?.motions?.[action]
      || (action === "idle" ? pet.live2d?.idleGroup : action === "thinking" ? pet.live2d?.talkGroup : undefined);
    playMotion(motionGroup);
  }, [action, applyExpression, definition, pet.live2d?.idleGroup, pet.live2d?.motions, pet.live2d?.talkGroup, playMotion, ready]);

  useEffect(() => {
    onReactToReady?.(ready && definition ? reactTo : undefined);
    return () => onReactToReady?.(undefined);
  }, [definition, onReactToReady, reactTo, ready]);

  if (!definition) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
      <canvas ref={canvasRef} className="h-full w-full" />
      {!ready && !error ? <span className="absolute inset-x-0 bottom-4 text-center text-xs text-white/70">Live2D loading...</span> : null}
      {error ? <span className="absolute inset-x-3 bottom-3 text-center text-xs leading-5 text-amber-100/80">Live2D unavailable. Image fallback remains active.</span> : null}
    </div>
  );
}
