import { aiModels, getAIModel } from "@/data/aiModels";
import { vtuberConfig } from "@/data/vtuberConfig";
import { callCloudChat, getCloudChatStatus } from "@/lib/vtuber/cloud";
import type { CloudChatMessage } from "@/lib/vtuber/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const modelId = new URL(request.url).searchParams.get("modelId") || undefined;
  return Response.json(getCloudChatStatus(aiModels, modelId));
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      messages?: unknown;
      modelId?: unknown;
      fileBase64?: unknown;
      fileMimeType?: unknown;
    };
    const requestedModelId = typeof body.modelId === "string" ? body.modelId : vtuberConfig.defaultAIModelId;
    const model = getAIModel(requestedModelId) || aiModels.find((item) => item.enabled !== false);
    if (!model) {
      return Response.json({ error: "没有可用的 AI 模型" }, { status: 400 });
    }
    if (!Array.isArray(body.messages)) {
      return Response.json({ error: "messages is required" }, { status: 400 });
    }

    const messages: CloudChatMessage[] = body.messages
      .slice(-vtuberConfig.maxContextMessages)
      .filter((item): item is CloudChatMessage => {
        if (!item || typeof item !== "object") return false;
        const value = item as Record<string, unknown>;
        return (value.role === "user" || value.role === "assistant") && typeof value.text === "string";
      })
      .map((item) => ({ role: item.role, text: item.text.trim().slice(0, 8000) }))
      .filter((item) => item.text);

    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return Response.json({ error: "最后一条消息必须来自用户" }, { status: 400 });
    }

    const reply = await callCloudChat({
      messages,
      systemPrompt: vtuberConfig.systemPrompt,
      model,
      fileBase64: typeof body.fileBase64 === "string" ? body.fileBase64 : undefined,
      fileMimeType: typeof body.fileMimeType === "string" ? body.fileMimeType : undefined,
    });
    return Response.json({ reply });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "AI 请求失败" },
      { status: 502 },
    );
  }
}
