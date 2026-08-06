import { NextResponse } from "next/server";

export const runtime = "nodejs";

function getTtsConfig() {
  const baseUrl = process.env.TTS_BASE_URL?.trim();
  const apiKey = process.env.TTS_API_KEY?.trim();
  const model = process.env.TTS_MODEL?.trim();
  return baseUrl && apiKey && model ? { baseUrl: baseUrl.replace(/\/$/, ""), apiKey, model } : null;
}

export async function GET() {
  return NextResponse.json({ ok: true, provider: getTtsConfig() ? "remote" : "browser" });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { text?: unknown; voice?: unknown };
    const text = typeof body.text === "string" ? body.text.trim().slice(0, 4000) : "";
    if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });

    const config = getTtsConfig();
    if (!config) return NextResponse.json({ provider: "browser" }, { headers: { "x-tts-fallback": "browser" } });

    const upstream = await fetch(`${config.baseUrl}/audio/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: config.model, input: text, voice: typeof body.voice === "string" ? body.voice : "alloy", response_format: "mp3" }),
    });
    if (!upstream.ok || !upstream.body) throw new Error("TTS provider request failed.");
    return new Response(upstream.body, { headers: { "Content-Type": upstream.headers.get("content-type") || "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "TTS request failed" }, { status: 502 });
  }
}
