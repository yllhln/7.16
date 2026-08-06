export const PARAM_LIST_PLACEHOLDER = "{{PARAM_LIST}}";
export const MODEL_NOTES_PLACEHOLDER = "{{MODEL_NOTES}}";

export const LIVE2D_EXPRESSION_SYSTEM_PROMPT = `You are a Live2D Cubism expression controller. Return only one JSON object.

Schema:
{"parameters":{"ParameterId":number},"durationMs":number,"holdMs":number}

Rules:
- Use only the listed parameter IDs.
- Keep ordinary conversation subtle and use stronger values only for clear emotion.
- Do not include markdown, explanations, or extra keys.

Allowed parameters:
${PARAM_LIST_PLACEHOLDER}

Model notes:
${MODEL_NOTES_PLACEHOLDER}`;
