"use client";

import { useEffect, useRef, useState } from "react";
import { Live2DRuntimeHandle, type Live2DMapping } from "@/lib/live2dRuntime";

export interface Live2DCanvasProps {
  modelUrl: string;
  backgroundUrl?: string;
  foregroundUrl?: string;
  behaviorProfile?: Live2DMapping["behaviorProfile"];
  emotion?: string;
  className?: string;
}

export default function Live2DCanvas({
  modelUrl,
  backgroundUrl,
  foregroundUrl,
  behaviorProfile,
  emotion,
  className,
}: Live2DCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<Live2DRuntimeHandle | undefined>(undefined);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const runtime = new Live2DRuntimeHandle({
      container,
      modelUrl,
      backgroundUrl,
      foregroundUrl,
      behaviorProfile,
    });
    runtimeRef.current = runtime;
    setError(undefined);

    runtime.load().catch((reason: unknown) => {
      if (!runtime.getSnapshot().destroyed) {
        setError(reason instanceof Error ? reason.message : "Live2D model failed to load.");
      }
    });

    return () => {
      runtime.destroy();
      if (runtimeRef.current === runtime) runtimeRef.current = undefined;
    };
  }, [modelUrl, backgroundUrl, foregroundUrl, behaviorProfile]);

  useEffect(() => {
    if (emotion) void runtimeRef.current?.playEmotion(emotion);
  }, [emotion]);

  return (
    <div
      ref={containerRef}
      aria-label="Live2D model"
      className={className}
      style={{
        position: "relative",
        width: "100%",
        minHeight: 420,
        overflow: "hidden",
        background: "transparent",
      }}
    >
      {error ? (
        <p role="status" style={{ padding: 24, color: "var(--foreground, #666)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
