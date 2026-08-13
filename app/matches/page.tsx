"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/client";

interface MatchedUser {
  match_id: string;
  user_id: string;
  name: string;
  age?: number;
  city?: string;
  avatar_url?: string;
  bio?: string;
}

export default function MatchesPage() {
  const supabase = createClient();
  const [matches, setMatches] = useState<MatchedUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMatches = async () => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      // 1. Загружаем все записи из таблицы matches, где участвует текущий пользователь
      const { data: matchesData, error: matchesError } = await supabase
        .from("matches")
        .select("*")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (matchesError || !matchesData) {
        console.error("Ошибка загрузки мэтчей:", matchesError);
        setLoading(false);
        return;
      }

      // 2. Достаем ID всех наших парных пользователей (собеседников)
      const partnerIds = matchesData.map((m) =>
        m.user1_id === user.id ? m.user2_id : m.user1_id
      );

      if (partnerIds.length === 0) {
        setMatches([]);
        setLoading(false);
        return;
      }

      // 3. Загружаем профили наших мэтчей из таблицы profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, age, city, avatar_url, avatar, photo, bio")
        .in("id", partnerIds);

      if (profilesError) {
        console.error("Ошибка загрузки профилей мэтчей:", profilesError);
      } else if (profilesData) {
        const formattedMatches: MatchedUser[] = matchesData.map((m) => {
          const partnerId = m.user1_id === user.id ? m.user2_id : m.user1_id;
          const profile = profilesData.find((p) => p.id === partnerId);

          return {
            match_id: m.id,
            user_id: partnerId,
            name: profile?.name || "Пользователь",
            age: profile?.age,
            city: profile?.city,
            avatar_url:
              profile?.avatar_url ||
              profile?.avatar ||
              profile?.photo ||
              "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500",
            bio: profile?.bio,
          };
        });

        setMatches(formattedMatches);
      }

      setLoading(false);
    };

    fetchMatches();
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />

      <main className="mx-auto flex w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <div className="grid flex-1 grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Sidebar */}
          <aside className="hidden lg:sticky lg:top-20 lg:block lg:col-span-3">
            <Sidebar />
          </aside>

          {/* Раздел с совпадениями */}
          <section className="col-span-1 lg:col-span-9">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-black text-gray-900">
                  Ваши Мэтчи ✨
                </h1>
                <p className="text-xs text-gray-400 mt-1">
                  Взаимные симпатии — начните общение прямо сейчас!
                </p>
              </div>
              <span className="rounded-full bg-pink-100 px-3 py-1 text-xs text-pink-600 font-extrabold">
                {matches.length}
              </span>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-pink-500 border-t-transparent"></div>
                <p className="mt-4 text-xs text-gray-400">Поиск совпадений...</p>
              </div>
            ) : matches.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-12 text-center shadow-sm space-y-3">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-pink-50 text-3xl">
                  💘
                </div>
                <h3 className="text-base font-bold text-gray-900">
                  Пока нет совпадений
                </h3>
                <p className="text-xs text-gray-400 max-w-xs mx-auto">
                  Лайкайте анкеты в поиске или отвечайте взаимностью на странице «Вам лайкнули»!
                </p>
                <div className="pt-2">
                  <Link
                    href="/discover"
                    className="inline-block rounded-2xl bg-pink-600 px-6 py-2.5 text-xs font-bold text-white transition hover:bg-pink-700 shadow-sm"
                  >
                    Искать анкеты
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {matches.map((match) => (
                  <div
                    key={match.match_id}
                    className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col items-center text-center justify-between"
                  >
                    <div className="flex flex-col items-center">
                      <div className="relative mb-3">
                        <img
                          src={match.avatar_url}
                          alt={match.name}
                          className="w-24 h-24 rounded-full object-cover border-4 border-pink-500 shadow-md"
                        />
                        <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full bg-green-500 border-2 border-white" />
                      </div>
                      <h3 className="text-base font-bold text-gray-900">
                        {match.name}
                        {match.age ? `, ${match.age}` : ""}
                      </h3>
                      {match.city && (
                        <p className="text-xs text-gray-400 mt-0.5">📍 {match.city}</p>
                      )}
                      {match.bio && (
                        <p className="text-xs text-gray-500 mt-2 line-clamp-2 px-2">
                          {match.bio}
                        </p>
                      )}
                    </div>

                    <Link
                      href={`/messages?userId=${match.user_id}`}
                      className="mt-5 w-full rounded-2xl bg-pink-50 hover:bg-pink-100 py-2.5 text-xs font-bold text-pink-600 transition text-center"
                    >
                      Написать сообщение 💬
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}