"use client";

import { useState } from "react";
import AIModal from "./AIModal";

export default function AIAssistant() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="bg-[#b3a4c4] text-white p-5 rounded-3xl shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold flex items-center gap-1.5 text-white">
            <span>🤖</span> AI Помощник
          </h3>
          <span className="text-[10px] bg-white/25 text-white px-2 py-0.5 rounded-full font-medium">
            Онлайн
          </span>
        </div>
        <p className="text-xs text-white/90 mb-4 leading-relaxed">
          Привет! 👋 Я помогу оформить профиль, подобрать первое сообщение и улучшить анкету.
        </p>
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full py-2.5 bg-white/20 hover:bg-white/30 transition border-none text-white rounded-xl cursor-pointer font-semibold text-xs"
        >
          Открыть AI
        </button>
      </div>

      {/* Само модальное окно */}
      <AIModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}