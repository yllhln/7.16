import rawModels from "./live2dModels.json";

export type Live2DExpression = {
  parameters: Record<string, number>;
  durationMs: number;
  holdMs: number;
};

export type Live2DExpressionPreset = Live2DExpression;

export type Live2DModelDefinition = {
  id: string;
  name: string;
  enabled: boolean;
  runtime: "cubism4";
  entryUrl: string;
  thumbnailUrl: string;
  notes?: string;
  layout?: { scale?: number; offsetX?: number; offsetY?: number };
  parameterRanges: Record<string, [number, number]>;
  presets: Record<string, Live2DExpression>;
};

export const live2dModels = rawModels as unknown as Live2DModelDefinition[];

export function getLive2DModel(id?: string) {
  return live2dModels.find((model) => model.id === id && model.enabled);
}
