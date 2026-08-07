"use client";

import { useState } from "react";

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AIAssistantModal({ isOpen, onClose }: AIAssistantModalProps) {
  const [activeTab, setActiveTab] = useState<"phrase" | "profile">("phrase");


const [loading, setLoading] = useState(false);
const [aiText, setAiText] = useState("");
  // Варианты фраз для знакомства
  const phrases = [
    "«Привет! Смотрю, у нас общие интересы. Как проходит твоя неделя? 😊»",
    "«Если бы твоё идеальное утро было напитком, это был бы раф, флэт уайт или просто кофе? ☕️»",
    "«Привет! Ты выглядишь как человек, у которого есть идеальный плейлист для вечерних прогулок ✨»",
    "«Правило первого сообщения: кто первым пишет, тот выбирает тему для разговора. Выбираешь ты или я? 🎲»",
    "«Привет! Как думаешь, какое самое идеальное место в городе для первого знакомства?»",
    "«Ого, классные фото! Посоветуешь крутое заведение или кофейню, где ты любишь бывать?»",
  ];

  // Варианты советов по улучшению анкеты
  const profileTips = [
    "💡 Добавь еще 2-3 фото из повседневной жизни, чтобы профиль выглядел более открытым и настоящим!",
    "💡 Укажи свои любимые хобби и рост — это повышает количество мэтчей на 40%!",
    "💡 Напиши в био короткий вопрос (например, 'Какой твой любимый фильм?'), чтобы людям было проще написать первыми.",
    "💡 Старайся избегать слишком официальных фото — добавь снимки с увлечений, путешествий или прогулок.",
  ];

  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen) return null;

  // Смена текущего варианта
 const handleGenerateNew = async () => {
  setLoading(true);
  setIsCopied(false);

  try {
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: activeTab,
        prompt:
          activeTab === "phrase"
            ? "Придумай первое сообщение девушке в приложении знакомств."
            : "Дай совет как улучшить мою анкету.",
      }),
    });

    const data = await response.json();

    setAiText(data.text);
  } catch (e) {
    setAiText("Не удалось получить ответ 😔");
  }

  setLoading(false);
};
  // Копирование фразы в буфер обмена
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const currentContent =
    activeTab === "phrase" ? phrases[currentPhraseIndex] : profileTips[currentTipIndex];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative space-y-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Шапка модального окна */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🤖</span>
            <h3 className="text-lg font-extrabold text-gray-900">AI Помощник Mingle</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full flex items-center justify-center font-bold text-sm transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-gray-500 font-medium">
          Выберите, чем я могу помочь вам прямо сейчас:
        </p>

        {/* Переключатели / Табы */}
        <div className="grid grid-cols-2 gap-2">
          <button
  onClick={() => {
    setActiveTab("profile");
    setAiText("");
    setIsCopied(false);
  }}
            className={`py-3 px-3 rounded-2xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 border ${
              activeTab === "phrase"
                ? "border-purple-600 bg-purple-50/60 text-purple-700 shadow-xs"
                : "border-gray-100 text-gray-600 hover:bg-gray-50"
            }`}
          >
            💬 Фраза для знакомства
          </button>

          <button
            onClick={() => {
              setActiveTab("profile");
              setIsCopied(false);
            }}
            className={`py-3 px-3 rounded-2xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 border ${
              activeTab === "profile"
                ? "border-pink-500 bg-pink-50/60 text-pink-600 shadow-xs"
                : "border-gray-100 text-gray-600 hover:bg-gray-50"
            }`}
          >
            ✨ Улучшить анкету
          </button>
        </div>

        {/* Контент с генерируемым ответом */}
        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 space-y-4">
          <p className="text-xs text-gray-800 font-medium leading-relaxed">
           {loading
  ? "Думаю..."
  : aiText || currentContent}
          </p>
          
          <div className="flex items-center justify-between pt-1 border-t border-gray-100/60">
            <button
              onClick={handleGenerateNew}
              className="text-[11px] font-bold text-pink-600 hover:text-pink-700 transition cursor-pointer flex items-center gap-1"
            >
              🎲 Сгенерировать еще
            </button>

            {activeTab === "phrase" && (
              <button
                onClick={() => handleCopy(aiText || currentContent)}
className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
  isCopied
    ? "bg-emerald-500 text-white"
    : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
}`}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  isCopied
                    ? "bg-emerald-500 text-white"
                    : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
                }`}
              >
                {isCopied ? "Скопировано! ✓" : "Копировать"}
              </button>
            )}
          </div>
        </div>

        {/* Кнопка «Готово» */}
        <button
          onClick={onClose}
          className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-3.5 rounded-2xl text-xs transition cursor-pointer"
        >
          Готово
        </button>

      </div>
    </div>
  );
}