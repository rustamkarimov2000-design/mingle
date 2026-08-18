"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Notification {
  id: string;
  user_id: string;
  actor_id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
  actor?: {
    name: string;
    avatar_url?: string | null;
    avatar?: string | null;
  };
}

export default function NotificationsPage() {
  const supabase = createClient();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("notifications")
      .select(`
        id,
        user_id,
        actor_id,
        type,
        title,
        message,
        link,
        is_read,
        created_at,
        profiles:actor_id (
          name,
          avatar_url,
          avatar
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Ошибка загрузки уведомлений:", error);
      setLoading(false);
      return;
    }

    setNotifications((data || []) as Notification[]);
    setLoading(false);
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);

    if (error) {
      console.error("Ошибка отметки уведомления:", error);
      return;
    }

    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id
          ? { ...notification, is_read: true }
          : notification
      )
    );
  };

  const markAllAsRead = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (error) {
      console.error("Ошибка:", error);
      return;
    }

    setNotifications((prev) =>
      prev.map((notification) => ({
        ...notification,
        is_read: true,
      }))
    );
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const getIcon = (type: string) => {
    if (type === "match") return "💚";
    if (type === "like") return "💌";
    if (type === "comment") return "💬";
    return "🔔";
  };

  const getTime = (date: string) => {
    return new Date(date).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-800 font-sans">
      <header className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="font-logo text-xl text-gray-900"
        >
          mingle
        </Link>

        <Link
          href="/"
          className="text-xs font-bold text-gray-500 hover:text-gray-900"
        >
          ← На главную
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 pb-12">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">

          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-black text-gray-900">
                Уведомления
              </h1>

              <p className="text-[11px] text-gray-400 mt-1">
                {unreadCount > 0
                  ? `${unreadCount} непрочитанных`
                  : "Все уведомления прочитаны"}
              </p>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[11px] font-bold text-pink-600 hover:text-pink-700"
              >
                Прочитать всё
              </button>
            )}
          </div>

          {loading ? (
            <div className="p-10 text-center text-xs text-gray-400">
              Загрузка уведомлений...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-4xl mb-3">🔔</div>

              <p className="text-sm font-bold text-gray-700">
                Пока нет уведомлений
              </p>

              <p className="text-xs text-gray-400 mt-1">
                Здесь будут появляться лайки, мэтчи и другие события.
              </p>
            </div>
          ) : (
            <div>
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => markAsRead(notification.id)}
                  className={`w-full text-left p-4 flex items-center gap-3 border-b border-gray-50 transition ${
                    notification.is_read
                      ? "bg-white hover:bg-gray-50"
                      : "bg-pink-50/50 hover:bg-pink-50"
                  }`}
                >
                  <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center text-xl shrink-0">
                    {getIcon(notification.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-gray-900">
                        {notification.title}
                      </span>

                      {!notification.is_read && (
                        <span className="w-2 h-2 rounded-full bg-pink-600 shrink-0" />
                      )}
                    </div>

                    <p className="text-[11px] text-gray-600 mt-1">
                      {notification.message}
                    </p>

                    <span className="text-[9px] text-gray-400 mt-1 block">
                      {getTime(notification.created_at)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}