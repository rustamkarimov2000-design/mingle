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
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const loadNotifications = async (currentUserId: string) => {
    setIsLoading(true);

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Ошибка загрузки уведомлений:", error);
      setIsLoading(false);
      return;
    }

    const rows = data || [];

    const actorIds = Array.from(
      new Set(
        rows
          .map((notification) => notification.actor_id)
          .filter(Boolean)
      )
    );

    let profilesMap = new Map<
      string,
      {
        name: string;
        avatar_url?: string | null;
        avatar?: string | null;
      }
    >();

    if (actorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, avatar_url, avatar")
        .in("id", actorIds);

      profilesMap = new Map(
        (profiles || []).map((profile) => [
          profile.id,
          {
            name: profile.name,
            avatar_url: profile.avatar_url,
            avatar: profile.avatar,
          },
        ])
      );
    }

    const formattedNotifications: Notification[] = rows.map(
      (notification) => ({
        ...notification,
        actor: profilesMap.get(notification.actor_id),
      })
    );

    setNotifications(formattedNotifications);
    setIsLoading(false);
  };

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsLoading(false);
        return;
      }

      setUserId(user.id);
      await loadNotifications(user.id);
    };

    loadUser();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("notifications_page")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadNotifications(userId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const markAsRead = async (notificationId: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    if (error) {
      console.error("Ошибка отметки уведомления:", error);
      return;
    }

    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === notificationId
          ? { ...notification, is_read: true }
          : notification
      )
    );
  };

  const markAllAsRead = async () => {
    if (!userId) return;

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) {
      console.error("Ошибка отметки всех уведомлений:", error);
      return;
    }

    setNotifications((prev) =>
      prev.map((notification) => ({
        ...notification,
        is_read: true,
      }))
    );
  };

  const deleteNotification = async (notificationId: string) => {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId);

    if (error) {
      console.error("Ошибка удаления уведомления:", error);
      return;
    }

    setNotifications((prev) =>
      prev.filter((notification) => notification.id !== notificationId)
    );
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "like":
        return "💖";
      case "match":
        return "💚";
      case "comment":
        return "💬";
      case "message":
        return "✉️";
      case "follow":
        return "👋";
      default:
        return "🔔";
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();

    const diff = Math.floor(
      (now.getTime() - date.getTime()) / 1000
    );

    if (diff < 60) return "только что";

    const minutes = Math.floor(diff / 60);
    if (minutes < 60) return `${minutes} мин. назад`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ч. назад`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} дн. назад`;

    return date.toLocaleDateString("ru-RU");
  };

  const unreadCount = notifications.filter(
    (notification) => !notification.is_read
  ).length;

  if (!userId && !isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 text-center shadow-xs border border-gray-100 max-w-sm w-full">
          <div className="text-4xl mb-3">🔔</div>

          <h1 className="text-lg font-black text-gray-900">
            Уведомления
          </h1>

          <p className="text-xs text-gray-400 mt-2">
            Войдите в аккаунт, чтобы видеть свои уведомления.
          </p>

          <Link
            href="/auth/login"
            className="inline-block mt-5 bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold px-5 py-2.5 rounded-2xl transition"
          >
            Войти
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-800 font-sans pb-12">
      {/* ШАПКА */}
      <header className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="font-logo text-xl text-gray-900"
        >
          mingle
        </Link>

        <Link
          href="/"
          className="text-xs text-gray-500 hover:text-gray-900 font-bold transition"
        >
          ← На главную
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 pt-5">
        {/* ЗАГОЛОВОК */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-gray-900">
                Уведомления
              </h1>

              {unreadCount > 0 && (
                <span className="bg-pink-600 text-white text-[10px] font-black min-w-[22px] h-[22px] px-1.5 rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>

            <p className="text-xs text-gray-400 mt-1">
              Здесь будут ваши лайки, мэтчи и другие события
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-[11px] font-bold text-pink-600 hover:text-pink-700 transition cursor-pointer"
            >
              Прочитать все
            </button>
          )}
        </div>

        {/* КОНТЕНТ */}
        {isLoading ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-gray-100">
            <p className="text-xs text-gray-400">
              Загрузка уведомлений...
            </p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-gray-100">
            <div className="text-5xl mb-4">🔔</div>

            <h2 className="text-sm font-black text-gray-900">
              Пока нет уведомлений
            </h2>

            <p className="text-xs text-gray-400 mt-2">
              Когда кто-нибудь поставит вам лайк или появится новый мэтч,
              здесь появится уведомление.
            </p>

            <Link
              href="/discover"
              className="inline-block mt-5 bg-[#E02868] hover:bg-pink-700 text-white text-xs font-bold px-5 py-2.5 rounded-2xl transition"
            >
              Смотреть людей
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
            {notifications.map((notification, index) => {
              const actorName =
                notification.actor?.name || "Пользователь";

              const actorAvatar =
                notification.actor?.avatar_url ||
                notification.actor?.avatar ||
                null;

              return (
                <div
                  key={notification.id}
                  className={`relative flex items-center gap-4 p-5 transition ${
                    index !== notifications.length - 1
                      ? "border-b border-gray-100"
                      : ""
                  } ${
                    !notification.is_read
                      ? "bg-pink-50/40"
                      : "bg-white"
                  }`}
                >
                  {/* ИКОНКА */}
                  <div className="relative shrink-0">
                    {actorAvatar ? (
                      <img
                        src={actorAvatar}
                        alt={actorName}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 text-white font-black flex items-center justify-center text-xs uppercase">
                        {actorName.slice(0, 2)}
                      </div>
                    )}

                    <div className="absolute -right-1 -bottom-1 w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center text-xs">
                      {getIcon(notification.type)}
                    </div>
                  </div>

                  {/* ТЕКСТ */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-black text-gray-900">
                        {notification.title}
                      </h3>

                      {!notification.is_read && (
                        <span className="w-2 h-2 rounded-full bg-pink-600 shrink-0" />
                      )}
                    </div>

                    <p className="text-xs text-gray-600 mt-1">
                      {notification.message}
                    </p>

                    <span className="text-[10px] text-gray-400 mt-1 block">
                      {getTimeAgo(notification.created_at)}
                    </span>
                  </div>

                  {/* ДЕЙСТВИЯ */}
                  <div className="flex items-center gap-2 shrink-0">
                    {!notification.is_read && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        title="Отметить как прочитанное"
                        className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-500 flex items-center justify-center text-xs transition cursor-pointer"
                      >
                        ✓
                      </button>
                    )}

                    {notification.type === "match" && (
                      <Link
                        href="/matches"
                        onClick={() =>
                          markAsRead(notification.id)
                        }
                        className="bg-pink-600 hover:bg-pink-700 text-white text-[10px] font-bold px-3 py-2 rounded-xl transition"
                      >
                        Мэтч
                      </Link>
                    )}

                    {notification.type === "like" && (
                      <Link
                        href="/likes"
                        onClick={() =>
                          markAsRead(notification.id)
                        }
                        className="bg-pink-50 hover:bg-pink-100 text-pink-600 text-[10px] font-bold px-3 py-2 rounded-xl transition"
                      >
                        Посмотреть
                      </Link>
                    )}

                    <button
                      onClick={() =>
                        deleteNotification(notification.id)
                      }
                      title="Удалить"
                      className="w-8 h-8 rounded-full hover:bg-red-50 text-gray-300 hover:text-red-500 flex items-center justify-center text-xs transition cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}