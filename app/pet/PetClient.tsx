"use client";

import { useState, useRef, useEffect } from 'react';
import { Paperclip, X, Trash2, Volume2, VolumeX } from 'lucide-react';
import Navbar from '../../components/Navbar';
import PageTransition from '../../components/PageTransition';
import { siteConfig } from '../../siteConfig';
import { useTheme } from '../../components/ThemeProvider';

type ChatMessage = {
  role: 'user' | 'ai';
  text: string;
  attachmentName?: string;
};

type AffectionTier = {
  threshold: number;
  name: string;
  themeColor?: string;
  background?: string;
  font?: string;
};

type AIModel = {
  id: string;
  provider?: string;
  name: string;
  avatar?: string;
  themeColor?: string;
  background?: string;
  font?: string;
  greeting?: string;
  systemPrompt?: string;
  rememberHistory?: boolean;
  shareHistoryWith?: string;
  ttsEnabled?: boolean;
  ttsRate?: number;
  ttsPitch?: number;
  danmakuEnabled?: boolean;
  momentsEnabled?: boolean;
  affectionTiers?: AffectionTier[];
};

const findModel = (id: string | undefined): AIModel | undefined =>
  (siteConfig.aiModels as AIModel[] | undefined)?.find(m => m.id === id);

const historyKeyOf = (model: AIModel) => model.shareHistoryWith || model.id;
const HISTORY_PREFIX = 'ai-pet-chat-history:';
const AFFECTION_PREFIX = 'ai-pet-affection:';
const LETTERS_KEY = 'ai-pet-letters';

export default function PetClient() {
  const { isDark } = useTheme();

  const activeModel: AIModel =
    findModel(isDark ? siteConfig.petNightModelId : siteConfig.petDayModelId) ||
    findModel(siteConfig.petNightModelId) ||
    (siteConfig.aiModels?.[0] as AIModel) ||
    { id: 'gemini', name: 'AI 宠物' };

  const historyKey = historyKeyOf(activeModel);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [affection, setAffection] = useState(0);
  const [ttsMuted, setTtsMuted] = useState(false);

  // 附件：图片走 base64，文本文件直接读成字符串拼进消息里
  const [attachedFile, setAttachedFile] = useState<{ name: string; base64?: string; mimeType?: string; textContent?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 挂载时：加载聊天记录 + 好感度
  useEffect(() => {
    setMounted(true);
    try {
      if (activeModel.rememberHistory) {
        const saved = localStorage.getItem(HISTORY_PREFIX + historyKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
          } else if (activeModel.greeting) {
            setMessages([{ role: 'ai', text: activeModel.greeting }]);
          }
        } else if (activeModel.greeting) {
          setMessages([{ role: 'ai', text: activeModel.greeting }]);
        }
      } else if (activeModel.greeting) {
        setMessages([{ role: 'ai', text: activeModel.greeting }]);
      }
    } catch {
      if (activeModel.greeting) setMessages([{ role: 'ai', text: activeModel.greeting }]);
    }

    try {
      const savedAffection = Number(localStorage.getItem(AFFECTION_PREFIX + historyKey) || '0');
      setAffection(isNaN(savedAffection) ? 0 : savedAffection);
    } catch {
      setAffection(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyKey]);

  // 消息变化时写回本地存储
  useEffect(() => {
    if (!mounted || !activeModel.rememberHistory) return;
    try {
      localStorage.setItem(HISTORY_PREFIX + historyKey, JSON.stringify(messages));
    } catch {
      // 忽略存储异常（比如隐私模式）
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, mounted]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  // 🌟 根据好感度，找出当前所在的阶梯（取满足条件里阈值最大的那一档）
  const currentTier: AffectionTier | undefined = (activeModel.affectionTiers || [])
    .filter(t => affection >= t.threshold)
    .sort((a, b) => b.threshold - a.threshold)[0];

  const accent = currentTier?.themeColor || activeModel.themeColor || '#6366f1';
  const background = currentTier?.background || activeModel.background || '';
  const font = currentTier?.font || activeModel.font || '';

  const handleFileSelect = (file: File) => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1] || '';
        setAttachedFile({ name: file.name, base64, mimeType: file.type });
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedFile({ name: file.name, textContent: String(reader.result || '') });
      };
      reader.readAsText(file);
    }
  };

  const speakText = (text: string) => {
    if (!activeModel.ttsEnabled || ttsMuted) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel(); // 打断上一句还没读完的
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = activeModel.ttsRate || 1;
      utter.pitch = activeModel.ttsPitch || 1;
      utter.lang = 'zh-CN';
      window.speechSynthesis.speak(utter);
    } catch {
      // 浏览器不支持就静默忽略，不影响聊天本身
    }
  };

  const bumpAffection = () => {
    setAffection(prev => {
      const next = prev + 1;
      try {
        localStorage.setItem(AFFECTION_PREFIX + historyKey, String(next));
      } catch {
        // 忽略
      }
      return next;
    });
  };

  const emitDanmaku = (text: string) => {
    if (!activeModel.danmakuEnabled) return;
    try {
      window.dispatchEvent(new CustomEvent('inject-danmaku', { detail: text.slice(0, 40) }));
    } catch {
      // 忽略
    }
  };

  const emitLetter = (text: string) => {
    if (!activeModel.momentsEnabled) return;
    try {
      const saved = JSON.parse(localStorage.getItem(LETTERS_KEY) || '[]');
      const list = Array.isArray(saved) ? saved : [];
      list.push({
        id: `ai-letter-${Date.now()}`,
        date: new Date().toISOString(),
        location: activeModel.name,
        images: [],
        content: text,
        isAILetter: true,
      });
      localStorage.setItem(LETTERS_KEY, JSON.stringify(list));
    } catch {
      // 忽略
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if ((!text && !attachedFile) || isLoading) return;

    // 拼接实际发给 AI 的文本：文本文件内容直接附加在消息后面
    let messageForAI = text;
    if (attachedFile?.textContent) {
      messageForAI = `${text}\n\n[附件: ${attachedFile.name}]\n${attachedFile.textContent}`;
    }

    setMessages(prev => [...prev, { role: 'user', text: text || `📎 ${attachedFile?.name}`, attachmentName: attachedFile?.name }]);
    setInputValue('');
    const fileForRequest = attachedFile;
    setAttachedFile(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: activeModel.provider || activeModel.id,
          message: messageForAI || '（用户发送了一张图片，没有额外文字）',
          systemPrompt: activeModel.systemPrompt,
          fileBase64: fileForRequest?.base64,
          fileMimeType: fileForRequest?.mimeType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI 请求失败');

      setMessages(prev => [...prev, { role: 'ai', text: data.reply }]);
      bumpAffection();
      speakText(data.reply);
      emitDanmaku(data.reply);
      emitLetter(data.reply);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'ai', text: `⚠️ 出错了：${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (!window.confirm('确定要清空和这只宠物的聊天记录吗？此操作无法撤销。')) return;
    const fresh = activeModel.greeting ? [{ role: 'ai' as const, text: activeModel.greeting }] : [];
    setMessages(fresh);
    try {
      localStorage.removeItem(HISTORY_PREFIX + historyKey);
    } catch {
      // 忽略
    }
  };

  return (
    <div
      className="min-h-screen relative pb-10 flex flex-col"
      style={background ? { backgroundImage: `url('${background}')`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
    >
      <Navbar />
      <PageTransition>
        <div className="w-[90%] max-w-2xl mx-auto pt-28 flex flex-col flex-1" style={font ? { fontFamily: font } : undefined}>

          {/* 好感度条 */}
          {(activeModel.affectionTiers?.length || 0) > 0 && (
            <div className="mb-4 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-2xl px-5 py-3 flex items-center justify-between border border-white/50 dark:border-slate-800/50">
              <div>
                <p className="text-xs font-black text-slate-500 dark:text-slate-400">好感度</p>
                <p className="text-sm font-black" style={{ color: accent }}>{currentTier?.name || '陌生'} · {affection}</p>
              </div>
              {activeModel.ttsEnabled && (
                <button
                  onClick={() => setTtsMuted(v => !v)}
                  className="p-2 rounded-xl text-slate-400 hover:bg-slate-500/10"
                  title={ttsMuted ? '开启语音播报' : '静音语音播报'}
                >
                  {ttsMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
              )}
            </div>
          )}

          <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/50 dark:border-slate-800/50 rounded-[32px] shadow-xl flex flex-col flex-1 overflow-hidden">

            <div className="px-6 py-4 flex items-center justify-between gap-3 border-b border-white/40 dark:border-slate-700/50" style={{ backgroundColor: `${accent}1A` }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0 overflow-hidden" style={{ backgroundColor: accent }}>
                  {activeModel.avatar ? <img src={activeModel.avatar} alt={activeModel.name} className="w-full h-full object-cover" /> : activeModel.name.slice(0, 1)}
                </div>
                <div>
                  <p className="font-black text-slate-800 dark:text-white text-sm">{activeModel.name}</p>
                  <p className="text-[11px] text-slate-400">{activeModel.rememberHistory ? '在线 · 记得你们的对话' : '在线 · 不会保留聊天记录'}</p>
                </div>
              </div>
              <button onClick={handleClearHistory} title="清空聊天记录" className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6 space-y-4 custom-scrollbar min-h-[360px] max-h-[55vh]">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
                      msg.role === 'user' ? 'text-white rounded-br-md' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-bl-md shadow-sm'
                    }`}
                    style={msg.role === 'user' ? { backgroundColor: accent } : undefined}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-slate-800 px-4 py-2.5 rounded-2xl rounded-bl-md shadow-sm text-sm text-slate-400">思考中...</div>
                </div>
              )}
            </div>

            {attachedFile && (
              <div className="px-4 pt-3 flex items-center gap-2">
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                  <Paperclip size={12} /> {attachedFile.name}
                  <button onClick={() => setAttachedFile(null)} className="text-slate-400 hover:text-red-500"><X size={12} /></button>
                </div>
              </div>
            )}

            <form onSubmit={handleSend} className="px-4 py-4 border-t border-white/40 dark:border-slate-700/50 flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,.txt,.md,.json,.csv"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }}
              />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2.5 rounded-2xl text-slate-400 hover:bg-slate-500/10 flex-shrink-0" title="发送文件">
                <Paperclip size={18} />
              </button>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={`跟 ${activeModel.name} 说点什么...`}
                disabled={isLoading}
                className="flex-1 bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 dark:text-white"
              />
              <button
                type="submit"
                disabled={isLoading || (!inputValue.trim() && !attachedFile)}
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
