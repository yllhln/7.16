"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { siteConfig } from '../siteConfig';
import { useTheme } from './ThemeProvider';

// 🌟 兜底：万一 aiModels 没配置或找不到对应人格，也不会崩
const findModel = (id: string | undefined) =>
  siteConfig.aiModels?.find((m: any) => m.id === id);

export default function CyberCat() {
  const { isDark } = useTheme();
  const [isClicking, setIsClicking] = useState(false); // 点击后短暂展示 2 秒
  const [isHovering, setIsHovering] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [speech, setSpeech] = useState<string | null>(null);
  const [showInput, setShowInput] = useState(false); // 对话框默认隐藏，点击猫咪才弹出
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const chatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false); // 用来区分这次是"点击"还是"长按松开"

  // 🌟 根据当前日/夜模式，决定当前用哪个 AI 人格 + 哪套桌宠皮肤
  const activeModel =
    findModel(isDark ? siteConfig.petNightModelId : siteConfig.petDayModelId) ||
    findModel(siteConfig.petNightModelId) ||
    siteConfig.aiModels?.[0];

  // 🌟 根据当前状态，决定该显示哪张图。优先级：长按 > 思考中 > 点击 > 悬停 > 待机
  // 当前人格没配置某个状态的图时，自动退回待机图；连待机图都没有，退回默认图
  const currentImage =
    (isHolding && activeModel?.petHoldImage) ||
    (isThinking && activeModel?.petClickImage) ||
    (isClicking && activeModel?.petClickImage) ||
    (isHovering && activeModel?.petHoverImage) ||
    activeModel?.petIdleImage ||
    '/siamese-cat.png';

  // --- 💬 说话功能 ---
  const speak = (text: string, duration = 6000) => {
    setSpeech(text);
    if (chatTimeoutRef.current) clearTimeout(chatTimeoutRef.current);
    chatTimeoutRef.current = setTimeout(() => {
      setSpeech(null);
    }, duration);
  };

  // --- 🖱️ 交互事件：单击猫猫，弹出/收起对话框 ---
  const handlePetCat = () => {
    if (isClicking) return;
    setIsClicking(true);
    setTimeout(() => {
      setIsClicking(false);
    }, 2000);

    setShowInput(prev => {
      const next = !prev;
      if (next) {
        // 弹出对话框时触发一句台词（以后接入 TTS 会在这里加语音播报）
        speak("寂寞的滴出水", 3000);
      }
      return next;
    });
  };

  // --- 🖐️ 交互事件：长按检测 ---
  const handlePressStart = () => {
    isLongPressRef.current = false;
    pressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setIsHolding(true);
    }, 400); // 按住超过 0.4 秒判定为长按
  };

  const handlePressEnd = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (isLongPressRef.current) {
      // 长按松开：结束长按状态，不触发点击效果
      setIsHolding(false);
    } else {
      // 没到长按时长：算作一次普通点击
      handlePetCat();
    }
  };

  const handlePressCancel = () => {
    // 鼠标移出等情况，直接取消，不算点击也不算长按
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    setIsHolding(false);
  };

  // --- 💬 交互事件：发送聊天 ---
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isThinking) return;

    const userMessage = inputValue;
    setInputValue('');
    setShowInput(false);
    setIsThinking(true);
    speak("让本喵想想喵...", 10000);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: activeModel?.provider || 'gemini',
          message: userMessage,
          systemPrompt: activeModel?.systemPrompt,
        }),
      });

      if (!res.ok) throw new Error('API Error');

      const data = await res.json();
      speak(data.reply, 8000);
    } catch (error) {
      speak("铲屎官的网线被老鼠咬断了吧？喵！", 4000);
    } finally {
      setIsThinking(false);
    }
  };

  // --- ⏳ 随机挂机语录 ---
  useEffect(() => {
    const randomBarks = [
      "喵呜~ 今天天气真不错喵~",
      "好困哦，想睡觉喵...",
      "铲屎官，快去敲代码！",
      "我的小鱼干藏哪里去了？",
      "怎么没人理本喵...",
    ];
    const randomTalkInterval = setInterval(() => {
      if (!speech && !showInput && !isThinking && Math.random() > 0.8) {
        const randomMsg = randomBarks[Math.floor(Math.random() * randomBarks.length)];
        speak(randomMsg, 4000);
      }
    }, 20000);

    return () => clearInterval(randomTalkInterval);
  }, [speech, showInput, isThinking]);

  // 🌟 桌宠总开关：控制台关掉之后，直接不渲染，网站右下角桌宠完全消失
  // 注意：这个判断必须放在所有 Hooks 调用之后，不能提前 return
  if (siteConfig.petEnabled === false) return null;

  return (
    <motion.div
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.1}
      whileDrag={{ scale: 1.1, cursor: "grabbing" }}
      className="fixed bottom-20 right-20 z-[9999] flex flex-col items-center cursor-grab active:cursor-grabbing"
    >
      {/* 💬 聊天气泡 */}
      <div className="relative w-full flex justify-center mb-6">
        <AnimatePresence>
          {speech && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="absolute bottom-0 bg-white dark:bg-slate-800 text-slate-700 dark:text-gray-200 px-4 py-3 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 text-sm max-w-[240px] break-words text-center leading-relaxed"
              style={{ pointerEvents: 'none', transformOrigin: 'bottom center' }}
            >
              {speech}
              <div className="absolute -bottom-[6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-white dark:bg-slate-800 border-b border-r border-gray-100 dark:border-slate-700 transform rotate-45"></div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 🐈 猫咪本体 */}
      {/* 猫咪图片容器：悬停/按下/松开/移出 分别对应 悬停/长按/点击/取消 */}
      <div
        className="w-[120px] h-[120px] relative cursor-pointer select-none"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => { setIsHovering(false); handlePressCancel(); }}
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
      >
        <img
          src={currentImage}
          alt="桌宠"
          draggable={false}
          className="w-full h-full object-contain drop-shadow-2xl pointer-events-none select-none"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>

      {/* ⌨️ 对话框：默认隐藏，点击猫咪才弹出 */}
      <AnimatePresence>
        {showInput && (
          <motion.form
            initial={{ opacity: 0, y: -6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.9 }}
            onSubmit={handleChatSubmit}
            className="mt-3 bg-white dark:bg-slate-800 p-1.5 rounded-full shadow-lg flex items-center border border-gray-200 dark:border-slate-700 w-56 z-20"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="跟煤球说点啥喵..."
              className="bg-transparent border-none outline-none text-sm px-3 py-1 w-full dark:text-white placeholder-gray-400"
              disabled={isThinking}
              autoFocus
            />
            <button
              type="submit"
              disabled={isThinking || !inputValue.trim()}
              className={`rounded-full p-1.5 ml-1 flex items-center justify-center transition-colors ${
                isThinking || !inputValue.trim() ? 'bg-gray-300 text-gray-500' : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
              </svg>
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  );
}