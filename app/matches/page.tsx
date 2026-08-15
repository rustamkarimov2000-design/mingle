"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/client";

interface MatchProfile {
  matchId: string;
  userId: string;
  name: string;
  age?: number;
  city?: string;
  avatar_url?: string;
  avatar?: string;
  createdAt: string | null;
}

export default function MatchesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [matches, setMatches] = useState<MatchProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadMatches = async () => {
      setIsLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
        return;
      }

      const { data: matchesData, error: matchesError } = await supabase
        .from("matches")
        .select("id, user1_id, user2_id, created_at")
        .or("user1_id.eq." + user.id + ",user2_id.eq." + user.id)
        .order("created_at", { ascending: false });

      if (matchesError) {
        console.error("Ошибка загрузки мэтчей:", matchesError);
        setIsLoading(false);
        return;
      }

      if (!matchesData || matchesData.length === 0) {
        setMatches([]);
        setIsLoading(false);
        return;
      }

      const otherIds = matchesData.map((m) =>
        m.user1_id === user.id ? m.user2_id : m.user1_id
      );

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, age, city, avatar_url, avatar")
        .in("id", otherIds);

      if (profilesError) {
        console.error("Ошибка загрузки профилей мэтчей:", profilesError);
        setIsLoading(false);
        return;
      }

      const merged = matchesData
        .map((m) => {
          const otherId = m.user1_id === user.id ? m.user2_id : m.user1_id;
          const profile = profilesData?.find((p) => p.id === otherId);
          if (!profile) return null;

          return {
            matchId: m.id,
            userId: otherId,
            name: profile.name,
            age: profile.age,
            city: profile.city,
            avatar_url: profile.avatar_url,
            avatar: profile.avatar,
            createdAt: m.created_at,
          } as MatchProfile;
        })
        .filter(Boolean) as MatchProfile[];

      setMatches(merged);
      setIsLoading(false);
    };

    loadMatches();
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6">
        <div className="grid flex-1 grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <aside className="hidden lg:sticky lg:top-20 lg:block lg:col-span-3">
            <Sidebar />
          </aside>

          <section className="col-span-1 lg:col-span-9">
            <h1 className="text-2xl font-black text-gray-900 mb-5">
              Ваши мэтчи ✨
            </h1>

            {isLoading ? (
              <div className="rounded-3xl border bg-white p-8 text-center text-xs text-gray-400">
                Загрузка мэтчей...
              </div>
            ) : matches.length === 0 ? (
              <div className="rounded-3xl border bg-white p-8 text-center shadow-sm space-y-3">
                <div className="text-5xl">💔</div>
                <h3 className="text-lg font-bold text-gray-900">
                  Пока нет мэтчей
                </h3>
                <p className="text-sm text-gray-500">
                  Лайкайте анкеты на странице «Смотреть людей» — как только
                  кто-то лайкнёт вас в ответ, здесь появится мэтч.
                </p>
                <Link
                  href="/discover"
                  className="inline-block rounded-2xl bg-pink-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-700"
                >
                  Смотреть анкеты
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {matches.map((match) => {
                  const photo =
                    match.avatar_url ||
                    match.avatar ||
                    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500";

                  return (
                    <div
                      key={match.matchId}
                      className="rounded-3xl border bg-white shadow-sm overflow-hidden flex flex-col"
                    >
                      <div className="relative w-full aspect-square bg-gray-200">
                        <img
                          src={photo}
                          alt={match.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="p-4 space-y-1">
                        <div className="flex items-baseline gap-2">
                          <h4 className="text-sm font-black text-gray-900">
                            {match.name}
                          </h4>
                          {match.age && (
                            <span className="text-xs text-gray-500">
                              {match.age}
                            </span>
                          )}
                        </div>
                        {match.city && (
                          <p className="text-[11px] text-gray-400">
                            {match.city}
                          </p>
                        )}

                        <Link
                          href={"/messages?userId=" + match.userId}
                          className="mt-2 block w-full text-center rounded-2xl bg-pink-50 hover:bg-pink-100 text-pink-600 text-xs font-bold py-2 transition"
                        >
                          Написать сообщение 💬
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
