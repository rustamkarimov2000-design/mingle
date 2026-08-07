"use client";

import { useState } from "react";

interface AIModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AIModal({ isOpen, onClose }: AIModalProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState("");

  if (!isOpen) return null;

  const handleGenerate = (type: string) => {
    setLoading(true);
    setResponse("");

    // Имитируем умный ответ ИИ (или здесь можно подключить реальный API, например, OpenAI/Gemini)
    setTimeout(() => {
      if (type === "icebreaker") {
        setResponse("«Привет! Смотрю, у нас общие интересы. Как проходит твоя неделя? 😊» — отличная фраза для старта!");
      } else if (type === "bio") {
        setResponse("«Люблю уютные кофейни, спонтанные поездки и хорошие фильмы. Ищу того, с кем можно разделить этот вайб ✨» — отличный вариант для профиля.");
      } else {
        setResponse("ИИ-помощник проанализировал ваш запрос: будьте собой, улыбайтесь на фото и задавайте открытые вопросы! 😉");
      }
      setLoading(false);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <h2 className="text-lg font-bold text-gray-900">AI Помощник Mingle</h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          Выберите, чем я могу помочь вам прямо сейчас:
        </p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => handleGenerate("icebreaker")}
            className="p-3 rounded-2xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold text-left transition border border-purple-100"
          >
            💬 Фраза для знакомства
          </button>
          <button
            onClick={() => handleGenerate("bio")}
            className="p-3 rounded-2xl bg-pink-50 hover:bg-pink-100 text-pink-700 text-xs font-semibold text-left transition border border-pink-100"
          >
            ✨ Улучшить анкету
          </button>
        </div>

        {/* Блок ответа ИИ */}
        {(loading || response) && (
          <div className="mb-4 rounded-2xl bg-gray-50 p-4 border border-gray-100 text-xs text-gray-700">
            {loading ? (
              <div className="flex items-center gap-2 text-gray-400">
                <div className="animate-spin h-3 w-3 border-2 border-purple-600 border-t-transparent rounded-full" />
                Генерую лучший вариант...
              </div>
            ) : (
              <p className="leading-relaxed">{response}</p>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-3 rounded-2xl bg-gray-900 text-white font-semibold text-xs hover:bg-gray-800 transition"
        >
          Готово
        </button>
      </div>
    </div>
  );
}