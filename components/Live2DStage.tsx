"use client";

import { useEffect, useRef } from "react";
import type { PetAction, PetProfile } from "@/data/petProfiles";

type Props = { pet: PetProfile; action: PetAction };

export default function Live2DStage({ pet, action }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<any>(null);

  useEffect(() => {
    let disposed = false;
    let app: any;

    async function mount() {
      const modelUrl = pet.live2d?.modelUrl;
      if (!modelUrl || pet.live2d?.runtime !== "cubism4" || !hostRef.current) return;
      try {
        const PIXI = await import("pixi.js");
        const { Live2DModel } = await import("pixi-live2d-display/cubism4");
        if (disposed || !hostRef.current) return;
        (window as any).PIXI = PIXI;
        const canvas = document.createElement("canvas");
        hostRef.current.replaceChildren(canvas);
        app = new PIXI.Application({ view: canvas, transparent: true, resizeTo: hostRef.current, antialias: true });
        const model = await Live2DModel.from(modelUrl, { autoInteract: false });
        if (disposed) return;
        modelRef.current = model;
        app.stage.addChild(model);
        const layout = () => {
          const scale = Math.min(hostRef.current!.clientWidth / model.width, hostRef.current!.clientHeight / model.height) * 0.9;
          model.scale.set(scale);
          model.anchor.set(0.5, 1);
          model.x = hostRef.current!.clientWidth / 2;
          model.y = hostRef.current!.clientHeight;
        };
        layout();
        window.addEventListener("resize", layout);
        (hostRef.current as any).__cleanup = () => window.removeEventListener("resize", layout);
      } catch (error) {
        console.warn("Cubism 4 model could not be loaded. Local fallback remains active.", error);
      }
    }

    void mount();
    return () => {
      disposed = true;
      (hostRef.current as any)?.__cleanup?.();
      modelRef.current?.destroy?.();
      app?.destroy?.(true, { children: true });
      modelRef.current = null;
    };
  }, [pet]);

  useEffect(() => {
    const model = modelRef.current;
    const group = pet.live2d?.motions?.[action] || pet.live2d?.idleGroup || "idle";
    if (!model || !group) return;
    try {
      model.motion(group, undefined, action === "happy" || action === "surprised" ? 3 : 2);
    } catch {
      // Motion groups are model-defined; missing groups should not break chat.
    }
  }, [action, pet]);

  return <div ref={hostRef} className="pointer-events-none absolute inset-0 z-10" aria-hidden="true" />;
}
