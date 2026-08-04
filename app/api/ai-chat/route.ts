// app/api/ai-chat/route.ts
//
// 🌟 AI 镜像页专用接口（和桌宠煤球用的 /api/chat 相互独立，互不影响）
// 前端只需要传 { modelId, message }，具体调用哪家 AI、怎么拼接请求，
// 全部由 lib/aiProviders.ts 里的注册表决定。

import { callAI } from '@/lib/aiProviders';
import { getAIModel } from '@/data/aiModels';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { modelId, message, systemPrompt, fileBase64, fileMimeType } = await req.json();

    if (!modelId || typeof modelId !== 'string') {
      return new Response(JSON.stringify({ error: '缺少 modelId 参数' }), { status: 400 });
    }
    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: '缺少 message 参数' }), { status: 400 });
    }

    const model = getAIModel(modelId);
    if (!model) {
      return new Response(JSON.stringify({ error: 'Unsupported AI model' }), { status: 400 });
    }

    const reply = await callAI(model.provider, { message, systemPrompt, fileBase64, fileMimeType, remoteModel: model.remoteModel });

    return new Response(JSON.stringify({ reply }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '未知错误';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
