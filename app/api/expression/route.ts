import { NextResponse } from "next/server";
import { getLive2DModel } from "@/data/live2dModels";
import { generateExpression } from "@/lib/live2d/llmExpression";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ok: true, fallback: "local-presets" });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { text?: unknown; modelId?: unknown };
    if (typeof body.text !== "string" || !body.text.trim()) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }
    const model = getLive2DModel(typeof body.modelId === "string" ? body.modelId : undefined);
    return NextResponse.json(await generateExpression(body.text, model));
  } catch {
    return NextResponse.json({ parameters: {}, durationMs: 320, holdMs: 800 });
  }
}
