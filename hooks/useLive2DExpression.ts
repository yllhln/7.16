"use client";

import { useEffect, useRef, useState } from "react";
import type { Live2DExpression, Live2DModelDefinition } from "@/data/live2dModels";
import { Live2DController } from "@/lib/live2d/Live2DController";

export function useLive2DExpression(definition?: Live2DModelDefinition) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<Live2DController | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !definition) return;
    let cancelled = false;
    const controller = new Live2DController(canvasRef.current, definition);
    controllerRef.current = controller;
    void controller.init().then(() => {
      if (!cancelled) setReady(true);
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Live2D failed to load.");
    });
    return () => {
      cancelled = true;
      controller.destroy();
      controllerRef.current = null;
      setReady(false);
    };
  }, [definition]);

  async function reactTo(text: string) {
    if (!controllerRef.current || !definition || !text.trim()) return;
    const response = await fetch("/api/expression", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, modelId: definition.id }),
    });
    if (!response.ok) return;
    controllerRef.current.applyExpression(await response.json() as Live2DExpression);
  }

  function applyExpression(expression: Live2DExpression) {
    controllerRef.current?.applyExpression(expression);
  }

  function playMotion(group?: string) {
    controllerRef.current?.playMotion(group);
  }

  return { canvasRef, ready, error, reactTo, applyExpression, playMotion };
}
