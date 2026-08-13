"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/client";

interface LikerProfile {
  id: string;
  name: string;
  age?: number;
  city?: string;
  avatar_url?: string;
  bio?: string;
  photo?: string;
}

export default function LikesPage() {
  const supabase = createClient();
  const [likers, setLikers] = useState<LikerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [matchedName, setMatchedName] = useState<string | null>(null);

  useEffect(() => {
    const fetchLikers = async () => {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      // 1. Получаем ID тех, кого МЫ уже лайкнули (чтобы исключить взаимные)
      const { data: myLikes } = await supabase
        .from("likes")
        .select("to_user_id")
        .eq("from_user_id", user.id);

      const myLikedIds = new Set(myLikes?.map((l) => l.to_user_id) || []);

      // 2. Получаем лайки, направленные НАМ
      const { data: likesData, error: likesError } = await supabase
        .from("likes")
        .select("from_user_id, created_at")
        .eq("to_user_id", user.id)
        .order("created_at", { ascending: false });

      if (likesError || !likesData) {
        console.error("Ошибка загрузки лайков:", likesError);
        setLoading(false);
        return;
      }

      // Оставляем только те лайки, на которые мы еще не ответили взаимностью
      const unreciprocatedLikes = likesData.filter(
        (l) => !myLikedIds.has(l.from_user_id)
      );

      const likerIds = unreciprocatedLikes.map((l) => l.from_user_id);

      if (likerIds.length === 0) {
        setLikers([]);
        setLoading(false);
        return;
      }

      // 3. Загружаем профили людей, лайкнувших нас
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, age, city, avatar_url, avatar, photo, bio")
        .in("id", likerIds);

      if (profilesError) {
        console.error("Ошибка загрузки профилей:", profilesError);
      } else if (profilesData) {
        const formatted: LikerProfile[] = profilesData.map((p) => ({
          id: p.id,
          name: p.name || "Без имени",
          age: p.age,
          city: p.city,
          avatar_url:
            p.avatar_url ||
            p.avatar ||
            p.photo ||
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500",
          bio: p.bio,
        }));
        setLikers(formatted);
      }

      setLoading(false);
    };

    fetchLikers();
  }, []);

  const handleLikeBack = async (liker: LikerProfile) => {
    setRespondingId(liker.id);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setRespondingId(null);
      return;
    }

    // 1. Отправляем ответный лайк
    const { error: likeError } = await supabase.from("likes").insert({
      from_user_id: user.id,
      to_user_id: liker.id,
    });

    if (likeError) {
      console.error("Ошибка отправки лайка:", likeError);
      setRespondingId(null);
      return;
    }

    // 2. СОЗДАЕМ ЗАПИСЬ В ТАБЛИЦЕ MATCHES
    const { error: matchError } = await supabase.from("matches").insert({
      user1_id: user.id,
      user2_id: liker.id,
    });

    if (matchError) {
      console.error("Ошибка создания мэтча в базе:", matchError);
    }

    // Удаляем из локального списка "Вам лайкнули"
    setLikers((prev) => prev.filter((l) => l.id !== liker.id));
    setMatchedName(liker.name);
    setRespondingId(null);
  };

  const handleSkip = (likerId: string) => {
    setLikers((prev) => prev.filter((l) => l.id !== likerId));
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />

      <main className="mx-auto flex w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <div className="grid flex-1 grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Sidebar */}
          <aside className="hidden lg:sticky lg:top-20 lg:block lg:col-span-3">
            <Sidebar />
          </aside>

          {/* Основная секция */}
          <section className="col-span-1 lg:col-span-9">
            {/* Оповещение о новом мэтче */}
            {matchedName && (
              <div className="mb-6 flex items-center justify-between rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 p-4 text-white shadow-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">🎉</span>
                  <div>
                    <p className="font-bold">Это взаимно!</p>
                    <p className="text-xs text-pink-100">
                      Вы и {matchedName} понравились друг другу. Теперь вы можете общаться в разделах «Мэтчи» и «Сообщения».
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setMatchedName(null)}
                  className="rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30"
                >
                  Закрыть
                </button>
              </div>
            )}

            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-black text-gray-900">
                  Вам лайкнули ❤️
                </h1>
                <p className="text-xs text-gray-400 mt-1">
                  Пользователи, которые проявили к вам симпатию
                </p>
              </div>
              <span className="rounded-full bg-pink-100 px-3 py-1 text-xs text-pink-600 font-extrabold">
                {likers.length}
              </span>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-pink-500 border-t-transparent"></div>
                <p className="mt-4 text-xs text-gray-400">Загрузка симпатий...</p>
              </div>
            ) : likers.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-12 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-pink-50 text-3xl">
                  💌
                </div>
                <h3 className="text-base font-bold text-gray-900">
                  Пока нет новых лайков
                </h3>
                <p className="mt-1 text-xs text-gray-400 max-w-sm mx-auto">
                  Заполните свой профиль подробнее и проявляйте активность в ленте поиска, чтобы вас заметили!
                </p>
                <Link
                  href="/discover"
                  className="mt-6 inline-block rounded-2xl bg-pink-600 px-6 py-2.5 text-xs font-bold text-white transition hover:bg-pink-700 shadow-sm"
                >
                  Смотреть анкеты
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {likers.map((liker) => (
                  <div
                    key={liker.id}
                    className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative h-64 w-full bg-gray-100">
                        <img
                          src={liker.avatar_url}
                          alt={liker.name}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <div className="absolute bottom-3 left-3 text-white">
                          <h3 className="text-lg font-bold">
                            {liker.name}
                            {liker.age ? `, ${liker.age}` : ""}
                          </h3>
                          {liker.city && (
                            <p className="text-xs text-gray-200">📍 {liker.city}</p>
                          )}
                        </div>
                      </div>

                      {liker.bio && (
                        <p className="p-4 text-xs text-gray-600 line-clamp-2">
                          {liker.bio}
                        </p>
                      )}
                    </div>

                    <div className="p-4 pt-0 grid grid-cols-2 gap-2 mt-2">
                      <button
                        onClick={() => handleSkip(liker.id)}
                        className="rounded-xl border border-gray-200 py-2.5 text-xs font-bold text-gray-500 hover:bg-gray-50 transition"
                      >
                        Пропустить
                      </button>
                      <button
                        disabled={respondingId === liker.id}
                        onClick={() => handleLikeBack(liker)}
                        className="rounded-xl bg-pink-600 py-2.5 text-xs font-bold text-white hover:bg-pink-700 transition disabled:opacity-50 flex items-center justify-center space-x-1"
                      >
                        {respondingId === liker.id ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <>
                            <span>Лайк</span>
                            <span>❤️</span>
                          </>
                        )}
                      </button>
                    </div>
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