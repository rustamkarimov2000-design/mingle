"use client";

import { useEffect, useState } from "react";

export default function Greeting() {
  const [userName, setUserName] = useState("Рустам");

  useEffect(() => {
    const savedUser = localStorage.getItem("mingle_user");
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed.name) setUserName(parsed.name);
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-[#e8b4b8] p-6 sm:p-8 text-white shadow-sm h-full flex flex-col justify-center">
      <div className="relative z-10 space-y-1.5">
        <span className="text-xs font-semibold text-white/90 uppercase tracking-wider flex items-center gap-1.5">
          🌙 Добрый вечер
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          {userName} 👋
        </h1>
        <p className="text-xs text-white/90 max-w-sm leading-relaxed">
          Сегодня отличный день, чтобы найти новые интересные знакомства.
        </p>
      </div>
    </div>
  );
}