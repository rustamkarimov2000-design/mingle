"use client";

import { useState } from "react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (userData: { name: string; avatar: string }) => void;
}

export default function AuthModal({ isOpen, onClose, onLogin }: AuthModalProps) {
  const [name, setName] = useState("");

  // Если модалка закрыта (isOpen === false), мы ничего не отрисовываем
  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Генерируем аватарку по введенному имени через бесплатный сервис ui-avatars
    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      name
    )}&background=ec4899&color=fff&bold=true`;

    // Передаем данные наверх в page.tsx и закрываем окно
    onLogin({ name, avatar });
    onClose();
    setName("");
  };

  return (
    // Черный полупрозрачный фон (бекдроп)
    <div className="fixed inset-0 z-50 flex items-center justify-between justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
      {/* Белая карточка модального окна */}
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border">
        
        {/* Кнопка крестика для закрытия */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 text-gray-400 hover:text-gray-600 font-bold text-xl"
        >
          ✕
        </button>

        {/* Заголовок */}
        <div className="text-center">
          <h2 className="text-2xl font-black text-pink-600">MINGLE</h2>
          <p className="mt-1 text-sm text-gray-500">Добро пожаловать обратно!</p>
        </div>

        {/* Форма входа */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
              Ваше имя
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Рустам"
              required
              className="w-full rounded-2xl border bg-gray-50 px-4 py-3 text-sm outline-none focus:border-pink-500 focus:bg-white focus:ring-2 focus:ring-pink-200 transition"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-2xl bg-pink-600 py-3 font-semibold text-white transition hover:bg-pink-700 shadow-lg shadow-pink-600/30"
          >
            Войти в аккаунт
          </button>
        </form>

        {/* Разделитель / Вход через Google (для красоты) */}
        <div className="mt-5 text-center text-xs text-gray-400">
          Нажимая «Войти», вы соглашаетесь с правилами сервиса Mingle
        </div>
      </div>
    </div>
  );
}