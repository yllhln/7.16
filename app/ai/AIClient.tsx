"use client";

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../../components/Navbar';
import PageTransition from '../../components/PageTransition';
import { siteConfig } from '../../siteConfig';

type ChatMessage = {
  role: 'user' | 'ai';
  text: string;
};

// 🌟 兜底：万一 siteConfig.aiModels 没配置或者是空数组，页面也不会崩
const aiModels = siteConfig.aiModels && siteConfig.aiModels.length > 0
  ? siteConfig.aiModels
  : [{ id: 'gemini', name: 'AI 助理', avatar: '', themeColor: '#6366f1', background: '', greeting: '你好呀，有什么想聊的吗？' }];

export default function AIClient() {
  const [selectedId, setSelectedId] = useState(aiModels[0].id);
  // 🌟 每个模型的对话记录各自独立保存，切换模型时互不干扰
  const [historyMap, setHistoryMap] = useState<Record<string, ChatMessage[]>>({});
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const activeModel = aiModels.find(m => m.id === selectedId) || aiModels[0];
  const messages = historyMap[selectedId] || [];

  // 首次切到某个模型时，塞入它的欢迎语
  useEffect(() => {
    setHistoryMap(prev => {
      if (prev[selectedId]) return prev; // 已经有记录了，不重复塞欢迎语
      return {
        ...prev,
        [selectedId]: activeModel.greeting ? [{ role: 'ai', text: activeModel.greeting }] : [],
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // 有新消息时自动滚动到底部
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  const appendMessage = (modelId: string, msg: ChatMessage) => {
    setHistoryMap(prev => ({
      ...prev,
      [modelId]: [...(prev[modelId] || []), msg],
    }));
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isLoading) return;

    setInputValue('');
    appendMessage(selectedId, { role: 'user', text });
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId: selectedId, message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI 请求失败');
      appendMessage(selectedId, { role: 'ai', text: data.reply });
    } catch (err: any) {
      appendMessage(selectedId, { role: 'ai', text: `⚠️ 出错了喵：${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  const accent = activeModel.themeColor || '#6366f1';

  return (
    <div
      className="min-h-screen relative pb-10 flex flex-col"
      style={activeModel.background ? {
        backgroundImage: `url('${activeModel.background}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : undefined}
    >
      <Navbar />

      <PageTransition>
        <div className="w-[90%] max-w-3xl mx-auto pt-28 flex flex-col flex-1">

          {/* 🌟 模型切换标签：目前只有一款，以后加了新模型会自动多出标签 */}
          {aiModels.length > 1 && (
            <div className="flex gap-2 mb-6 flex-wrap">
              {aiModels.map(model => {
                const isActive = model.id === selectedId;
                return (
                  <button
                    key={model.id}
                    onClick={() => setSelectedId(model.id)}
                    className={`px-4 py-2 rounded-2xl text-sm font-black transition-all border ${
                      isActive
                        ? 'text-white shadow-lg border-transparent'
                        : 'bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                    style={isActive ? { backgroundColor: model.themeColor || '#6366f1' } : undefined}
                  >
                    {model.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* 🌟 聊天面板 */}
          <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/50 dark:border-slate-800/50 rounded-[32px] shadow-xl flex flex-col flex-1 overflow-hidden">

            {/* 头部：当前模型信息 */}
            <div
              className="px-6 py-4 flex items-center gap-3 border-b border-white/40 dark:border-slate-700/50"
              style={{ backgroundColor: `${accent}1A` /* 主题色 10% 透明度做底色 */ }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0 overflow-hidden"
                style={{ backgroundColor: accent }}
              >
                {activeModel.avatar
                  ? <img src={activeModel.avatar} alt={activeModel.name} className="w-full h-full object-cover" />
                  : activeModel.name.slice(0, 1)}
              </div>
              <div>
                <p className="font-black text-slate-800 dark:text-white text-sm">{activeModel.name}</p>
                <p className="text-[11px] text-slate-400">在线 · 随时可以聊</p>
              </div>
            </div>

            {/* 消息列表 */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6 space-y-4 custom-scrollbar min-h-[360px] max-h-[55vh]">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
                      msg.role === 'user'
                        ? 'text-white rounded-br-md'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-bl-md shadow-sm'
                    }`}
                    style={msg.role === 'user' ? { backgroundColor: accent } : undefined}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-slate-800 px-4 py-2.5 rounded-2xl rounded-bl-md shadow-sm text-sm text-slate-400">
                    思考中...
                  </div>
                </div>
              )}
            </div>

            {/* 输入区 */}
            <form onSubmit={handleSend} className="px-4 py-4 border-t border-white/40 dark:border-slate-700/50 flex items-center gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={`跟 ${activeModel.name} 说点什么...`}
                disabled={isLoading}
                className="flex-1 bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 dark:text-white"
                style={{ boxShadow: 'none' }}
              />
              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className="px-5 py-2.5 rounded-2xl text-sm font-black text-white transition-opacity disabled:opacity-40"
                style={{ backgroundColor: accent }}
              >
                发送
              </button>
            </form>
          </div>
        </div>
      </PageTransition>
    </div>
  );
}
