"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface UserStatusProps {
  userId: string;
  lastSeen?: string;
}

export default function UserStatus({ userId, lastSeen }: UserStatusProps) {
  const [isOnline, setIsOnline] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    // Подключаемся к глобальному каналу онлайн-пользователей
    const room = supabase.channel("online-users");

    room
      .on("presence", { event: "sync" }, () => {
        const state = room.presenceState();
        // Проверяем, есть ли userId среди подключенных
        const onlineUserIds = Object.values(state)
          .flat()
          .map((presence: any) => presence.user_id);

        setIsOnline(onlineUserIds.includes(userId));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            // Регистрируем текущего пользователя как онлайн
            await room.track({ user_id: user.id, online_at: new Date().toISOString() });
          }
        }
      });

    return () => {
      supabase.removeChannel(room);
    };
  }, [userId]);

  // Форматирование времени "Был недавно"
  const formatLastSeen = (dateString?: string) => {
    if (!dateString) return "Был(а) недавно";
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

    if (diffMinutes < 5) return "Был(а) только что";
    if (diffMinutes < 60) return `Был(а) ${diffMinutes} мин. назад`;
    
    return `Был(а) в ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="flex items-center space-x-1.5">
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          isOnline ? "bg-green-500 animate-pulse" : "bg-gray-300"
        }`}
      />
      <span className="text-xs text-gray-500">
        {isOnline ? "В сети" : formatLastSeen(lastSeen)}
      </span>
    </div>
  );
}