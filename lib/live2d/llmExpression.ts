import type { Live2DExpression, Live2DModelDefinition } from "@/data/live2dModels";
import { LIVE2D_EXPRESSION_SYSTEM_PROMPT, MODEL_NOTES_PLACEHOLDER, PARAM_LIST_PLACEHOLDER } from "./systemPrompt";

type ExpressionLLMConfig = { baseUrl: string; apiKey: string; model: string };

const defaultRanges: Record<string, [number, number]> = {
  ParamAngleX: [-30, 30],
  ParamAngleY: [-30, 30],
  ParamAngleZ: [-30, 30],
  ParamEyeLOpen: [0, 1],
  ParamEyeROpen: [0, 1],
  ParamEyeLSmile: [0, 1],
  ParamEyeRSmile: [0, 1],
  ParamBrowLY: [-1, 1],
  ParamBrowRY: [-1, 1],
  ParamMouthForm: [-1, 1],
  ParamMouthOpenY: [0, 1],
  ParamCheek: [0, 1],
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function rangesFor(model?: Live2DModelDefinition) {
  return model?.parameterRanges && Object.keys(model.parameterRanges).length ? model.parameterRanges : defaultRanges;
}

function fallbackExpression(text: string, model?: Live2DModelDefinition): Live2DExpression {
  const lower = text.toLowerCase();
  const happy = ["谢谢", "喜欢", "开心", "高兴", "哈哈", "great", "thank", "love", "happy"].some((word) => lower.includes(word));
  const upset = ["难过", "焦虑", "害怕", "生气", "累", "失败", "sorry", "sad", "angry"].some((word) => lower.includes(word));
  const unsure = ["?", "？", "怎么", "为什么", "不确定", "think", "maybe"].some((word) => lower.includes(word));
  const key = happy ? "happy" : upset ? "surprised" : unsure ? "thinking" : "idle";
  return model?.presets[key] || { parameters: {}, durationMs: 350, holdMs: 900 };
}

function extractJson(value: string): Record<string, unknown> {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Expression response did not contain JSON.");
  return JSON.parse(value.slice(start, end + 1));
}

export function sanitizeExpression(raw: Record<string, unknown>, model?: Live2DModelDefinition): Live2DExpression {
  const ranges = rangesFor(model);
  const values = (raw.parameters && typeof raw.parameters === "object" ? raw.parameters : {}) as Record<string, unknown>;
  const parameters: Record<string, number> = {};
  for (const [id, value] of Object.entries(values)) {
    const range = ranges[id];
    if (!range || typeof value !== "number" || !Number.isFinite(value)) continue;
    parameters[id] = clamp(value, range[0], range[1]);
  }
  return {
    parameters,
    durationMs: clamp(Number(raw.durationMs ?? raw.duration_ms) || 450, 100, 3000),
    holdMs: clamp(Number(raw.holdMs ?? raw.hold_ms) || 1800, 0, 10000),
  };
}

function getConfig(): ExpressionLLMConfig | null {
  const baseUrl = process.env.LIVE2D_EXPRESSION_BASE_URL?.trim();
  const apiKey = process.env.LIVE2D_EXPRESSION_API_KEY?.trim();
  const model = process.env.LIVE2D_EXPRESSION_MODEL?.trim();
  return baseUrl && apiKey && model ? { baseUrl: baseUrl.replace(/\/$/, ""), apiKey, model } : null;
}

function buildPrompt(model?: Live2DModelDefinition) {
  const ranges = rangesFor(model);
  const parameters = Object.entries(ranges).map(([id, [min, max]]) => `${id}: ${min} to ${max}`).join("\n");
  return LIVE2D_EXPRESSION_SYSTEM_PROMPT
    .replace(PARAM_LIST_PLACEHOLDER, parameters)
    .replace(MODEL_NOTES_PLACEHOLDER, model?.notes || "No additional notes.");
}

export async function generateExpression(text: string, model?: Live2DModelDefinition): Promise<Live2DExpression> {
  const config = getConfig();
  if (!config) return fallbackExpression(text, model);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        messages: [{ role: "system", content: buildPrompt(model) }, { role: "user", content: text.slice(0, 1600) }],
      }),
    });
    if (!response.ok) throw new Error(`Expression LLM failed with ${response.status}.`);
    const payload = await response.json();
    return sanitizeExpression(extractJson(payload.choices?.[0]?.message?.content || ""), model);
  } catch {
    return fallbackExpression(text, model);
  }
}
