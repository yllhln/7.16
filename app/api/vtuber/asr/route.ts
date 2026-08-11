export const runtime = "nodejs";
export const maxDuration = 60;

function getAsrConfig() {
  const apiKey = process.env.ASR_API_KEY?.trim();
  const model = process.env.ASR_MODEL?.trim() || "whisper-1";
  const baseUrl = (process.env.ASR_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
  return apiKey ? { apiKey, model, baseUrl } : null;
}

export async function GET() {
  return Response.json({ configured: Boolean(getAsrConfig()) });
}

export async function POST(request: Request) {
  try {
    const config = getAsrConfig();
    if (!config) return Response.json({ error: "未配置 ASR_API_KEY" }, { status: 503 });

    const input = await request.formData();
    const audio = input.get("audio");
    if (!(audio instanceof File) || audio.size === 0) {
      return Response.json({ error: "audio is required" }, { status: 400 });
    }
    if (audio.size > 20 * 1024 * 1024) {
      return Response.json({ error: "录音不能超过 20MB" }, { status: 413 });
    }

    const formData = new FormData();
    formData.append("file", audio, audio.name || "recording.webm");
    formData.append("model", config.model);
    formData.append("response_format", "json");
    if (process.env.ASR_LANGUAGE?.trim()) formData.append("language", process.env.ASR_LANGUAGE.trim());

    const response = await fetch(`${config.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: formData,
      signal: AbortSignal.timeout(55_000),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message || `ASR 请求失败: ${response.status}`);
    return Response.json({ text: String(payload.text || "").trim() });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "语音识别失败" },
      { status: 502 },
    );
  }
}
