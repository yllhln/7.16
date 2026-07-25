// lib/aiProviders.ts
//
// 🌟 AI 镜像页 · 供应商注册表
// -------------------------------------------------
// 这是整个"多款 AI 可扩展架构"的核心文件。
// 以后想接入新的大模型（比如 DeepSeek、智谱、通义千问……），
// 只需要在下面的 providers 对象里新增一个 key，其他文件完全不用动。
//
// ⚠️ 安全约定：这个文件只在服务器端运行（被 API 路由引用），
// API Key 永远只从 process.env 读取，不会出现在 siteConfig.ts 里，
// 也就不会被打包进浏览器能看到的前端代码。

type ChatParams = {
  message: string;
  systemPrompt?: string;
};

type ProviderHandler = (params: ChatParams) => Promise<string>;

// --- 🔮 Gemini（谷歌）---
const callGemini: ProviderHandler = async ({ message, systemPrompt }) => {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) throw new Error('未配置 GEMINI_API_KEY 环境变量');

  const modelId = process.env.GEMINI_AI_PAGE_MODEL || 'gemini-2.5-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
      contents: [{ parts: [{ text: message }] }],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || `Gemini 请求失败: ${response.status}`);
  }
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '（模型没有返回内容）';
};

// --- 🧩 以后新增模型示例（暂未启用，供参考）---
// const callDeepSeek: ProviderHandler = async ({ message, systemPrompt }) => {
//   const apiKey = (process.env.DEEPSEEK_API_KEY || '').trim();
//   if (!apiKey) throw new Error('未配置 DEEPSEEK_API_KEY 环境变量');
//   const response = await fetch('https://api.deepseek.com/chat/completions', {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: `Bearer ${apiKey}`,
//     },
//     body: JSON.stringify({
//       model: 'deepseek-chat',
//       messages: [
//         ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
//         { role: 'user', content: message },
//       ],
//     }),
//   });
//   const data = await response.json();
//   if (!response.ok) throw new Error(data.error?.message || `DeepSeek 请求失败: ${response.status}`);
//   return data.choices?.[0]?.message?.content || '（模型没有返回内容）';
// };

// 🌟 注册表：key 必须和 siteConfig.aiModels 里对应条目的 id 完全一致
const providers: Record<string, ProviderHandler> = {
  gemini: callGemini,
  // deepseek: callDeepSeek,  // 以后启用新模型时，把这一行取消注释即可
};

export async function callAI(modelId: string, params: ChatParams): Promise<string> {
  const handler = providers[modelId];
  if (!handler) {
    throw new Error(`未知的模型 ID: "${modelId}"（还没有在 lib/aiProviders.ts 里注册）`);
  }
  return handler(params);
}
