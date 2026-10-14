"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fetchBlockedUserIds } from "@/lib/blocking";

interface Toast {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  actorName?: string;
  actorAvatar?: string | null;
}

const ICONS: Record<string, string> = {
  like: "💖",
  match: "💚",
  comment: "💬",
  message: "✉️",
  follow: "👋",
  event_join: "🎉",
};

export default function ToastNotifications() {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

  const [toasts, setToasts] = useState<Toast[]>([]);
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const dismiss = (id: string) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let blockedIds = new Set<string>();

    const subscribe = async (userId: string) => {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }

      try {
        blockedIds = await fetchBlockedUserIds(supabase, userId);
      } catch {
        blockedIds = new Set();
      }

      channel = supabase
        .channel("toast_notifications_" + userId)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: "user_id=eq." + userId,
          },
          async (payload) => {
            const n: any = payload.new;
            if (!n) return;
            if (n.actor_id && blockedIds.has(n.actor_id)) return;

            // Если человек уже на странице уведомлений — тост не нужен
            if (pathnameRef.current?.startsWith("/notifications")) return;

            let actorName: string | undefined;
            let actorAvatar: string | null = null;

            if (n.actor_id) {
              const { data: p } = await supabase
                .from("profiles")
                .select("name, avatar_url, avatar")
                .eq("id", n.actor_id)
                .maybeSingle();
              actorName = p?.name;
              actorAvatar = p?.avatar_url || p?.avatar || null;
            }

            const toast: Toast = {
              id: String(n.id),
              type: n.type,
              title: n.title || "Новое уведомление",
              message: n.message || "",
              link: n.link || null,
              actorName,
              actorAvatar,
            };

            setToasts((prev) => [toast, ...prev].slice(0, 3));
            setTimeout(() => dismiss(toast.id), 6000);
          }
        )
        .subscribe();
    };

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) subscribe(user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        subscribe(session.user.id);
      } else if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    });

    return () => {
      subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => {
            dismiss(t.id);
            router.push(t.link || "/notifications");
          }}
          className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-lg transition hover:shadow-xl"
        >
          <div className="relative shrink-0">
            {t.actorAvatar ? (
              <img
                src={t.actorAvatar}
                alt=""
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-purple-500 text-[10px] font-black uppercase text-white">
                {(t.actorName || "??").slice(0, 2)}
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] shadow-sm">
              {ICONS[t.type] || "🔔"}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-gray-900">{t.title}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">
              {t.message}
            </p>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              dismiss(t.id);
            }}
            className="shrink-0 cursor-pointer text-sm font-bold text-gray-300 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
