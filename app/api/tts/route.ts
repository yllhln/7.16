import { NextResponse } from "next/server";

export const runtime = "nodejs";

type OpenAICompatibleTtsConfig = {
  provider: "openai-compatible";
  baseUrl: string;
  apiKey: string;
  model: string;
};

type VolcengineTtsConfig = {
  provider: "volcengine";
  endpoint: string;
  appId: string;
  accessToken: string;
  cluster: string;
  voiceType: string;
  speedRatio: number;
  volumeRatio: number;
  pitchRatio: number;
};

type TtsConfig = OpenAICompatibleTtsConfig | VolcengineTtsConfig;

function boundedRatio(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(2, Math.max(0.5, parsed)) : fallback;
}

function getOpenAICompatibleConfig(): OpenAICompatibleTtsConfig | null {
  const baseUrl = process.env.TTS_BASE_URL?.trim();
  const apiKey = process.env.TTS_API_KEY?.trim();
  const model = process.env.TTS_MODEL?.trim();
  return baseUrl && apiKey && model
    ? { provider: "openai-compatible", baseUrl: baseUrl.replace(/\/$/, ""), apiKey, model }
    : null;
}

function getVolcengineConfig(): VolcengineTtsConfig | null {
  const appId = process.env.VOLC_TTS_APP_ID?.trim();
  const accessToken = process.env.VOLC_TTS_ACCESS_TOKEN?.trim() || process.env.VOLC_TTS_TOKEN?.trim();
  const cluster = process.env.VOLC_TTS_CLUSTER?.trim();
  const voiceType = process.env.VOLC_TTS_VOICE_TYPE?.trim();
  if (!appId || !accessToken || !cluster || !voiceType) return null;

  return {
    provider: "volcengine",
    endpoint: (process.env.VOLC_TTS_ENDPOINT?.trim() || "https://openspeech.bytedance.com/api/v1/tts").replace(/\/$/, ""),
    appId,
    accessToken,
    cluster,
    voiceType,
    speedRatio: boundedRatio(process.env.VOLC_TTS_SPEED_RATIO, 1),
    volumeRatio: boundedRatio(process.env.VOLC_TTS_VOLUME_RATIO, 1),
    pitchRatio: boundedRatio(process.env.VOLC_TTS_PITCH_RATIO, 1),
  };
}

function getTtsConfig(): TtsConfig | null {
  const provider = process.env.TTS_PROVIDER?.trim().toLowerCase();
  const openAICompatible = getOpenAICompatibleConfig();
  const volcengine = getVolcengineConfig();
  if (provider === "volcengine") return volcengine;
  if (provider === "openai" || provider === "openai-compatible") return openAICompatible;
  return openAICompatible || volcengine;
}

function responseError(response: { status: number; statusText: string }, message?: string) {
  return new Error(message || `TTS provider request failed (${response.status} ${response.statusText}).`);
}

async function synthesizeWithOpenAICompatible(config: OpenAICompatibleTtsConfig, text: string, voice: string) {
  const upstream = await fetch(`${config.baseUrl}/audio/speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({ model: config.model, input: text, voice, response_format: "mp3" }),
  });
  if (!upstream.ok || !upstream.body) throw responseError(upstream);
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "audio/mpeg",
      "Cache-Control": "no-store",
      "X-TTS-Provider": config.provider,
    },
  });
}

async function synthesizeWithVolcengine(config: VolcengineTtsConfig, text: string, requestedVoice: string) {
  // "alloy" is this project's legacy default. Fall back to the configured Volcengine voice in that case.
  const voiceType = requestedVoice && requestedVoice !== "alloy" ? requestedVoice : config.voiceType;
  const upstream = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer;${config.accessToken}`,
    },
    body: JSON.stringify({
      app: { appid: config.appId, token: config.accessToken, cluster: config.cluster },
      user: { uid: "xhblogs-web" },
      audio: {
        voice_type: voiceType,
        encoding: "mp3",
        speed_ratio: config.speedRatio,
        volume_ratio: config.volumeRatio,
        pitch_ratio: config.pitchRatio,
      },
      request: {
        reqid: crypto.randomUUID(),
        text,
        text_type: "plain",
        operation: "query",
      },
    }),
  });

  const result = await upstream.json().catch(() => null) as { code?: number; message?: string; data?: string } | null;
  if (!upstream.ok || !result?.data || (typeof result.code === "number" && result.code !== 0 && result.code !== 3000)) {
    throw responseError(upstream, result?.message || "Volcengine TTS request failed.");
  }

  const audio = new Uint8Array(Buffer.from(result.data, "base64"));
  return new Response(audio, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
      "X-TTS-Provider": config.provider,
    },
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, provider: getTtsConfig()?.provider || "browser" });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { text?: unknown; voice?: unknown };
    const text = typeof body.text === "string" ? body.text.trim().slice(0, 4000) : "";
    if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });

    const config = getTtsConfig();
    if (!config) return NextResponse.json({ provider: "browser" }, { headers: { "x-tts-fallback": "browser" } });
    const voice = typeof body.voice === "string" ? body.voice.trim() : "alloy";
    return config.provider === "volcengine"
      ? synthesizeWithVolcengine(config, text, voice)
      : synthesizeWithOpenAICompatible(config, text, voice);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "TTS request failed" }, { status: 502 });
  }
}
