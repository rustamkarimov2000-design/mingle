"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface IcebreakerButtonProps {
  // id собеседника (мэтча)
  targetUserId: string;
  // Что делать с выбранным вариантом — обычно подставить в поле ввода
  onPick: (text: string) => void;
  // Последние сообщения переписки (необязательно). Если есть — ИИ предложит продолжение диалога.
  recentMessages?: { mine: boolean; text: string }[];
  className?: string;
}

const PROFILE_FIELDS =
  "name, age, city, bio, occupation, dating_goal, interests, prompts";

export default function IcebreakerButton({
  targetUserId,
  onPick,
  recentMessages,
  className,
}: IcebreakerButtonProps) {
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  const generate = async (nextRound: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Нужно войти в аккаунт.");
        setIsLoading(false);
        return;
      }

      const [meRes, otherRes] = await Promise.all([
        supabase.from("profiles").select(PROFILE_FIELDS).eq("id", user.id).single(),
        supabase.from("profiles").select(PROFILE_FIELDS).eq("id", targetUserId).single(),
      ]);

      const response = await fetch("/api/ai/icebreaker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          me: meRes.data,
          other: otherRes.data,
          recent: recentMessages || [],
          seed: String(nextRound),
        }),
      });

      const result = await response.json();

      if (result.error || !result.suggestions?.length) {
        setError(result.error || "Не удалось получить варианты.");
        setSuggestions([]);
      } else {
        setSuggestions(result.suggestions);
      }
    } catch (err) {
      console.error("Ошибка AI-подсказок:", err);
      setError("Не удалось связаться с AI-помощником.");
    }

    setIsLoading(false);
  };

  const handleOpen = () => {
    if (open) {
      setOpen(false);
      return;
    }

    setOpen(true);

    if (suggestions.length === 0) {
      generate(0);
    }
  };

  const handleRefresh = () => {
    const next = round + 1;
    setRound(next);
    generate(next);
  };

  return (
    <div className={"relative " + (className || "")}>
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-bold px-3 py-1.5 rounded-full transition cursor-pointer"
      >
        ✨ Подсказать, что написать
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />

          <div className="absolute bottom-full left-0 mb-2 z-20 w-80 max-w-[85vw] bg-white rounded-2xl shadow-lg border border-gray-100 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black text-gray-900">Варианты от ИИ</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-700 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {isLoading ? (
              <p className="text-[11px] text-gray-400 animate-pulse py-4 text-center">
                Придумываю варианты...
              </p>
            ) : error ? (
              <p className="text-[11px] text-red-500 py-2">{error}</p>
            ) : (
              <div className="space-y-1.5">
                {suggestions.map((text, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      onPick(text);
                      setOpen(false);
                    }}
                    className="w-full text-left bg-gray-50 hover:bg-pink-50 border border-gray-100 hover:border-pink-200 rounded-xl px-3 py-2 text-[11px] text-gray-700 transition cursor-pointer"
                  >
                    {text}
                  </button>
                ))}
              </div>
            )}

            {!isLoading && (
              <button
                type="button"
                onClick={handleRefresh}
                className="w-full text-[11px] font-bold text-purple-600 hover:text-purple-700 py-1 cursor-pointer"
              >
                🔄 Другие варианты
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
