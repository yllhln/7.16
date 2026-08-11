import { getAIModel } from "@/data/aiModels";
import { callAI } from "@/lib/aiProviders";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const { modelId, message, systemPrompt, fileBase64, fileMimeType } = await request.json();

    if (!modelId || typeof modelId !== "string") {
      return Response.json({ error: "缺少 modelId 参数" }, { status: 400 });
    }
    if (!message || typeof message !== "string") {
      return Response.json({ error: "缺少 message 参数" }, { status: 400 });
    }

    const model = getAIModel(modelId);
    if (!model) {
      return Response.json({ error: "Unsupported AI model" }, { status: 400 });
    }

    const reply = await callAI(model.provider, {
      message,
      systemPrompt,
      fileBase64,
      fileMimeType,
      remoteModel: model.remoteModel,
    });

    return Response.json({ reply });
  } catch (error: unknown) {
    return Response.json(
      { error: error instanceof Error ? error.message : "未知错误" },
      { status: 500 },
    );
  }
}
