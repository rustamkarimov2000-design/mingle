"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface AdminUser {
  id: string;
  name: string | null;
  city: string | null;
  avatar_url?: string | null;
  avatar?: string | null;
  last_seen: string | null;
  is_banned: boolean;
  is_admin: boolean;
}

interface Stats {
  users: number;
  banned: number;
  activeToday: number;
  events: number;
  upcomingEvents: number;
  posts: number;
  matches: number;
  pendingReports: number;
  totalReports: number;
  pendingVerifications: number;
}

type UserFilter = "all" | "banned";

const PAGE_SIZE = 30;

function formatLastSeen(value: string | null) {
  if (!value) return "давно";
  const d = new Date(value);
  return (
    d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
  );
}

export default function AdminPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const countOf = async (table: string, apply?: (q: any) => any) => {
    let q: any = supabase.from(table).select("id", { count: "exact", head: true });
    if (apply) q = apply(q);
    const { count } = await q;
    return count || 0;
  };

  const loadStats = async () => {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const [
      users,
      banned,
      activeToday,
      events,
      upcomingEvents,
      posts,
      matches,
      pendingReports,
      totalReports,
      pendingVerifications,
    ] = await Promise.all([

      countOf("profiles"),
      countOf("profiles", (q) => q.eq("is_banned", true)),
      countOf("profiles", (q) => q.gte("last_seen", dayAgo)),
      countOf("events"),
      countOf("events", (q) => q.gte("event_date", now.toISOString())),
      countOf("posts"),
      countOf("matches"),
      countOf("reports", (q) => q.eq("status", "pending")),
      countOf("reports"),
      countOf("verification_requests", (q) => q.eq("status", "pending")),
    ]);

    setStats({
      users,
      banned,
      activeToday,
      events,
      upcomingEvents,
      posts,
      matches,
      pendingReports,
      totalReports,
      pendingVerifications,
    });
  };

  const loadUsers = useCallback(
    async (reset: boolean, offset: number) => {
      setIsLoadingUsers(true);

      let query = supabase
        .from("profiles")
        .select("id, name, city, avatar_url, avatar, last_seen, is_banned, is_admin")
        .order("last_seen", { ascending: false, nullsFirst: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (filter === "banned") query = query.eq("is_banned", true);
      if (search.trim()) query = query.ilike("name", "%" + search.trim() + "%");

      const { data, error } = await query;

      if (error) {
        console.error("Ошибка загрузки пользователей:", error);
        setIsLoadingUsers(false);
        return;
      }

      const rows = (data || []) as AdminUser[];
      setUsers((prev) => (reset ? rows : [...prev, ...rows]));
      setHasMore(rows.length === PAGE_SIZE);
      setIsLoadingUsers(false);
    },
    [filter, search]
  );

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
        return;
      }

      setMyId(user.id);

      const { data: me } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (!me?.is_admin) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      setIsAdmin(true);
      await loadStats();
      setIsLoading(false);
    };

    init();
  }, []);

  useEffect(() => {
    if (isAdmin) loadUsers(true, 0);
  }, [isAdmin, loadUsers]);

  const handleToggleBan = async (u: AdminUser) => {
    if (u.id === myId) {
      alert("Нельзя заблокировать самого себя.");
      return;
    }

    const willBan = !u.is_banned;

    if (
      !confirm(
        willBan
          ? "Заблокировать " +
              (u.name || "пользователя") +
              "? Он исчезнет из ленты, поиска, мэтчей и лайков у всех."
          : "Разблокировать " + (u.name || "пользователя") + "?"
      )
    ) {
      return;
    }

    setBusyId(u.id);

    const { data, error } = await supabase
      .from("profiles")
      .update({ is_banned: willBan })
      .eq("id", u.id)
      .select("id");

    setBusyId(null);

    if (error) {
      alert("Не удалось изменить статус: " + error.message);
      return;
    }

    if (!data || data.length === 0) {
      alert("Статус не изменился — вероятно, нет прав (RLS-политика для администраторов).");
      return;
    }

    setUsers((prev) =>
      filter === "banned" && !willBan
        ? prev.filter((x) => x.id !== u.id)
        : prev.map((x) => (x.id === u.id ? { ...x, is_banned: willBan } : x))
    );

    setStats((prev) =>
      prev ? { ...prev, banned: Math.max(0, prev.banned + (willBan ? 1 : -1)) } : prev
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center text-xs text-gray-400 animate-pulse">
        Загрузка...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 text-center border border-gray-100 max-w-sm w-full space-y-3">
          <p className="text-sm font-bold text-gray-800">Доступ только для администраторов</p>
          <Link href="/" className="text-xs font-bold text-pink-600">
            ← На главную
          </Link>
        </div>
      </div>
    );
  }

  const cards: { label: string; value: number | string; hint?: string; href?: string; accent?: boolean }[] = stats
    ? [
        { label: "Пользователей", value: stats.users, hint: "активных за сутки: " + stats.activeToday },
        { label: "Заблокировано", value: stats.banned },
        { label: "События", value: stats.events, hint: "предстоящих: " + stats.upcomingEvents },
        { label: "Посты", value: stats.posts },
        { label: "Мэтчи", value: stats.matches },
        {
          label: "Жалобы",
          value: stats.pendingReports,
          hint: "ожидают · всего " + stats.totalReports,
          href: "/admin/reports",
          accent: stats.pendingReports > 0,
        },
        {
          label: "Проверка фото",
          value: stats.pendingVerifications,
          hint: "ожидают проверки",
          href: "/admin/verifications",
          accent: stats.pendingVerifications > 0,
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-800 pb-12">
      <header className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <span className="text-sm font-black tracking-wider text-gray-900">🛡️ АДМИНКА</span>
        <div className="flex items-center gap-4">
          <Link href="/admin/verifications" className="text-xs font-bold text-pink-600 hover:text-pink-700">
            Проверка фото →
          </Link>
          <Link href="/admin/reports" className="text-xs font-bold text-pink-600 hover:text-pink-700">
            Жалобы →
          </Link>
          <Link href="/" className="text-xs font-bold text-gray-500 hover:text-gray-900">
            ← На главную
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 pt-2 space-y-6">
        {/* СЧЁТЧИКИ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {cards.map((c) => {
            const body = (
              <div
                className={
                  "rounded-3xl p-5 border h-full " +
                  (c.accent ? "bg-pink-50 border-pink-200" : "bg-white border-gray-100") +
                  (c.href ? " hover:shadow-md transition cursor-pointer" : "")
                }
              >
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{c.label}</p>
                <p className={"text-3xl font-black mt-1 " + (c.accent ? "text-pink-600" : "text-gray-900")}>
                  {c.value}
                </p>
                {c.hint && <p className="text-[10px] text-gray-400 mt-1">{c.hint}</p>}
              </div>
            );

            return c.href ? (
              <Link key={c.label} href={c.href}>
                {body}
              </Link>
            ) : (
              <div key={c.label}>{body}</div>
            );
          })}
        </div>

        {/* ПОЛЬЗОВАТЕЛИ */}
        <section className="bg-white rounded-3xl border border-gray-100 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <h2 className="text-sm font-black text-gray-900">Пользователи</h2>

            <div className="flex items-center gap-2">
              {(["all", "banned"] as UserFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer " +
                    (filter === f ? "bg-black text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")
                  }
                >
                  {f === "all" ? "Все" : "Заблокированные"}
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchInput);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Поиск по имени..."
              className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-xs focus:outline-none focus:border-pink-500"
            />
            <button
              type="submit"
              className="bg-[#E02868] hover:bg-pink-700 text-white text-xs font-bold px-4 rounded-2xl transition cursor-pointer"
            >
              Найти
            </button>
          </form>

          <div className="divide-y divide-gray-50">
            {users.length === 0 && !isLoadingUsers ? (
              <p className="text-xs text-gray-400 text-center py-6">Никого не найдено</p>
            ) : (
              users.map((u) => {
                const avatar = u.avatar_url || u.avatar;
                const isMe = u.id === myId;

                return (
                  <div key={u.id} className="flex items-center gap-3 py-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-[10px] font-bold text-gray-600 uppercase shrink-0">
                      {avatar ? (
                        <img src={avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (u.name || "??").slice(0, 2)
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-gray-900 truncate">
                          {u.name || "Без имени"}
                        </span>
                        {u.is_admin && (
                          <span className="bg-purple-50 text-purple-600 text-[9px] font-bold px-2 py-0.5 rounded-full">
                            админ
                          </span>
                        )}
                        {u.is_banned && (
                          <span className="bg-red-50 text-red-600 text-[9px] font-bold px-2 py-0.5 rounded-full">
                            заблокирован
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 truncate">
                        {u.city ? u.city + " · " : ""}был(а): {formatLastSeen(u.last_seen)}
                      </p>
                    </div>

                    {!isMe && (
                      <button
                        onClick={() => handleToggleBan(u)}
                        disabled={busyId === u.id}
                        className={
                          "text-[11px] font-bold px-3 py-1.5 rounded-xl transition cursor-pointer disabled:opacity-50 shrink-0 " +
                          (u.is_banned
                            ? "bg-green-50 text-green-700 hover:bg-green-100"
                            : "bg-red-50 text-red-600 hover:bg-red-100")
                        }
                      >
                        {busyId === u.id ? "..." : u.is_banned ? "Разблокировать" : "Заблокировать"}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {isLoadingUsers && (
            <p className="text-xs text-gray-400 text-center animate-pulse">Загрузка...</p>
          )}

          {hasMore && !isLoadingUsers && (
            <button
              onClick={() => loadUsers(false, users.length)}
              className="w-full bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs font-bold py-3 rounded-2xl transition cursor-pointer"
            >
              Показать ещё
            </button>
          )}
        </section>
      </main>
    </div>
  );
}
