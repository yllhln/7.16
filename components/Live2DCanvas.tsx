"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Live2DRuntimeHandle, type Live2DMapping } from "@/lib/live2dRuntime";

export interface Live2DCanvasProps {
  modelUrl: string;
  backgroundUrl?: string;
  foregroundUrl?: string;
  behaviorProfile?: Live2DMapping["behaviorProfile"];
  className?: string;
}

export interface Live2DCanvasHandle {
  playEmotion: (emotion: string) => Promise<void>;
}

const Live2DCanvas = forwardRef<Live2DCanvasHandle, Live2DCanvasProps>(function Live2DCanvas({
  modelUrl,
  backgroundUrl,
  foregroundUrl,
  behaviorProfile,
  className,
}: Live2DCanvasProps, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<Live2DRuntimeHandle | undefined>(undefined);
  const [error, setError] = useState<string>();

  useImperativeHandle(ref, () => ({
    async playEmotion(nextEmotion: string) {
      await runtimeRef.current?.playEmotion(nextEmotion);
    },
  }), []);

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
});

export default Live2DCanvas;
