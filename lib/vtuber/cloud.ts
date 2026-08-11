import "server-only";

import type { CloudChatMessage } from "./types";

type ChatInput = {
  messages: CloudChatMessage[];
  systemPrompt: string;
  fileBase64?: string;
  fileMimeType?: string;
};

type GeminiPart = {
  text?: string;
  inline_data?: { mime_type: string; data: string };
};

function cleanBaseUrl(value: string | undefined, fallback: string) {
  return (value?.trim() || fallback).replace(/\/$/, "");
}

type CloudChatProvider = "gemini" | "openai-compatible";

function providerName(): CloudChatProvider {
  const provider = process.env.AI_CHAT_PROVIDER?.trim().toLowerCase() || "gemini";
  if (provider !== "gemini" && provider !== "openai-compatible") {
    throw new Error(`不支持的 AI_CHAT_PROVIDER: ${provider}`);
  }
  return provider;
}

export function getCloudChatStatus() {
  let provider: CloudChatProvider;
  try {
    provider = providerName();
  } catch (error) {
    return {
      provider: process.env.AI_CHAT_PROVIDER?.trim().toLowerCase() || "gemini",
      configured: false,
      error: error instanceof Error ? error.message : "AI_CHAT_PROVIDER 配置无效",
    };
  }
  const configured = provider === "gemini"
    ? Boolean(process.env.GEMINI_API_KEY?.trim())
    : Boolean(process.env.AI_CHAT_API_KEY?.trim() && process.env.AI_CHAT_MODEL?.trim());
  return { provider, configured };
}

async function callGemini({ messages, systemPrompt, fileBase64, fileMimeType }: ChatInput) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("未配置 GEMINI_API_KEY");

  const model = process.env.AI_CHAT_MODEL?.trim() || "gemini-2.5-flash-lite";
  const contents = messages.map((message, index) => {
    const parts: GeminiPart[] = [{ text: message.text }];
    const isLastUserMessage = message.role === "user" && index === messages.length - 1;
    if (isLastUserMessage && fileBase64 && fileMimeType) {
      parts.push({ inline_data: { mime_type: fileMimeType, data: fileBase64 } });
    }
    return { role: message.role === "assistant" ? "model" : "user", parts };
  });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
      }),
      signal: AbortSignal.timeout(55_000),
    },
  );
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || `Gemini 请求失败: ${response.status}`);
  return String(payload.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
}

async function callOpenAICompatible({ messages, systemPrompt, fileBase64, fileMimeType }: ChatInput) {
  const apiKey = process.env.AI_CHAT_API_KEY?.trim();
  const model = process.env.AI_CHAT_MODEL?.trim();
  if (!apiKey || !model) throw new Error("未配置 AI_CHAT_API_KEY 或 AI_CHAT_MODEL");

  const upstreamMessages = messages.map((message, index) => {
    const isLastUserMessage = message.role === "user" && index === messages.length - 1;
    if (!isLastUserMessage || !fileBase64 || !fileMimeType) return { role: message.role, content: message.text };
    return {
      role: message.role,
      content: [
        { type: "text", text: message.text },
        { type: "image_url", image_url: { url: `data:${fileMimeType};base64,${fileBase64}` } },
      ],
    };
  });

  const response = await fetch(`${cleanBaseUrl(process.env.AI_CHAT_BASE_URL, "https://api.openai.com/v1")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      messages: [{ role: "system", content: systemPrompt }, ...upstreamMessages],
    }),
    signal: AbortSignal.timeout(55_000),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || `LLM 请求失败: ${response.status}`);
  return String(payload.choices?.[0]?.message?.content || "").trim();
}

export async function callCloudChat(input: ChatInput) {
  const reply = providerName() === "openai-compatible"
    ? await callOpenAICompatible(input)
    : await callGemini(input);
  if (!reply) throw new Error("云端模型没有返回内容");
  return reply;
}
