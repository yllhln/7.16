"use client";

import { useEffect, useRef, useState } from "react";
import { getLive2DModel, type Live2DExpression } from "@/data/live2dModels";
import { Live2DController } from "@/lib/live2d/Live2DController";

type Props = {
  modelId: string;
  expression?: Live2DExpression | null;
  mouthOpen?: number;
};

export default function Live2DCanvas({ modelId, expression, mouthOpen = 0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<Live2DController | null>(null);
  const [loadedModelId, setLoadedModelId] = useState<string | null>(null);
  const [failedModelId, setFailedModelId] = useState<string | null>(null);
  const definition = getLive2DModel(modelId);
  const ready = loadedModelId === modelId;
  const error = !definition || failedModelId === modelId;

  useEffect(() => {
    if (!canvasRef.current || !definition) return;
    let cancelled = false;
    const controller = new Live2DController(canvasRef.current, definition);
    controllerRef.current = controller;
    void controller.init().then(() => {
      if (!cancelled) setLoadedModelId(modelId);
    }).catch(() => {
      if (!cancelled) setFailedModelId(modelId);
    });
    return () => {
      cancelled = true;
      controller.destroy();
      controllerRef.current = null;
    };
  }, [definition, modelId]);

  useEffect(() => {
    if (expression) controllerRef.current?.applyExpression(expression);
  }, [expression]);

  useEffect(() => {
    controllerRef.current?.setMouthOpen(mouthOpen);
  }, [mouthOpen]);

  return (
    <div className="absolute inset-0" aria-label="Live2D assistant">
      <canvas ref={canvasRef} className={`h-full w-full transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"}`} />
      {!ready && !error ? <div className="absolute inset-0 grid place-items-center text-sm text-white/60">Live2D loading...</div> : null}
      {error ? <div className="absolute inset-0 grid place-items-center px-8 text-center text-sm text-amber-100/80">Live2D unavailable</div> : null}
    </div>
  );
}
