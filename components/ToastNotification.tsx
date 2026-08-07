"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string;
  subMessage?: string;
  avatar?: string;
  onClose: () => void;
}

export default function ToastNotification({
  message,
  subMessage,
  avatar,
  onClose,
}: ToastProps) {
  // Автоматически закрываем уведомление через 4 секунды
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-xl border border-gray-100 animate-in slide-in-from-bottom-5 fade-in duration-300 max-w-sm">
      {avatar ? (
        <img
          src={avatar}
          alt="Avatar"
          className="h-10 w-10 rounded-full object-cover border border-pink-200 shadow-sm"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pink-50 text-pink-600 font-bold text-lg">
          🔥
        </div>
      )}
      
      <div className="flex-1 pr-2">
        <p className="text-xs font-bold text-gray-900">{message}</p>
        {subMessage && (
          <p className="text-[11px] text-gray-500 mt-0.5 truncate">{subMessage}</p>
        )}
      </div>

      <button
        onClick={onClose}
        className="h-6 w-6 rounded-full text-gray-400 hover:bg-gray-100 flex items-center justify-center text-xs transition"
      >
        ✕
      </button>
    </div>
  );
}