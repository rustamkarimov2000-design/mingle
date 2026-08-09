"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface LikerProfile {
  id: string;
  name: string;
  age?: number;
  city?: string;
  avatar_url?: string;
  avatar?: string;
  likeId: number;
}

export default function LikesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [likers, setLikers] = useState<LikerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [matchedName, setMatchedName] = useState<string | null>(null);

  useEffect(() => {
    const loadLikes = async () => {
      setIsLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
        return;
      }

      const { data: likesData, error: likesError } = await supabase
        .from("likes")
        .select("id, from_user_id, created_at")
        .eq("to_user_id", user.id)
        .order("created_at", { ascending: false });

      if (likesError) {
        console.error("Ошибка загрузки лайков:", likesError);
        setIsLoading(false);
        return;
      }

      if (!likesData || likesData.length === 0) {
        setLikers([]);
        setIsLoading(false);
        return;
      }

      const fromIds = likesData.map((l) => l.from_user_id);

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, age, city, avatar_url, avatar")
        .in("id", fromIds);

      if (profilesError) {
        console.error("Ошибка загрузки профилей:", profilesError);
        setIsLoading(false);
        return;
      }

      const merged = likesData
        .map((like) => {
          const profile = profilesData?.find((p) => p.id === like.from_user_id);
          if (!profile) return null;
          return { ...profile, likeId: like.id } as LikerProfile;
        })
        .filter(Boolean) as LikerProfile[];

      setLikers(merged);
      setIsLoading(false);
    };

    loadLikes();
  }, []);

  const handleLikeBack = async (liker: LikerProfile) => {
    setRespondingId(liker.id);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase.from("likes").insert({
      from_user_id: user.id,
      to_user_id: liker.id,
    });

    if (error) {
      console.error("Ошибка отправки лайка:", error);
      setRespondingId(null);
      return;
    }

    setLikers((prev) => prev.filter((l) => l.id !== liker.id));
    setMatchedName(liker.name);
    setRespondingId(null);
  };

  const handleSkip = async (liker: LikerProfile) => {
    setRespondingId(liker.id);

    const { error } = await supabase
      .from("likes")
      .delete()
      .eq("id", liker.likeId);

    if (error) {
      console.error("Ошибка при пропуске:", error);
    }

    setLikers((prev) => prev.filter((l) => l.id !== liker.id));
    setRespondingId(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center text-xs text-gray-400 animate-pulse">
        Загрузка лайков...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-800 flex flex-col items-center pb-8">
      <header className="w-full max-w-md px-6 h-16 flex items-center justify-between border-b border-gray-100 bg-white sticky top-0 z-20">
        <Link
          href="/discover"
          className="text-xs font-bold text-gray-500 hover:text-gray-900 transition"
        >
          {"\u2190 \u041a \u0430\u043d\u043a\u0435\u0442\u0430\u043c"}
        </Link>
        <span className="text-sm font-black tracking-wider text-gray-900">
          ВАМ ЛАЙКНУЛИ
        </span>
        <span className="w-12" />
      </header>

      {matchedName && (
        <div className="w-full max-w-md px-4 pt-4">
          <div className="bg-pink-50 border border-pink-100 text-pink-600 text-xs font-semibold rounded-2xl p-3 text-center">
            {"\u2764\ufe0f \u042d\u0442\u043e \u043c\u044d\u0442\u0447! \u0412\u044b \u0438 " +
              matchedName +
              " \u043f\u043e\u043d\u0440\u0430\u0432\u0438\u043b\u0438\u0441\u044c \u0434\u0440\u0443\u0433 \u0434\u0440\u0443\u0433\u0443"}
          </div>
        </div>
      )}

      <main className="w-full max-w-md flex-1 px-4 pt-4">
        {likers.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20 text-gray-400">
            <div className="text-4xl mb-3">👀</div>
            <p className="text-sm font-semibold">Пока никто не лайкнул</p>
            <p className="text-xs mt-1">
              Возвращайтесь позже или посмотрите анкеты сами
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {likers.map((liker) => {
              const photo =
                liker.avatar_url ||
                liker.avatar ||
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500";

              const isBusy = respondingId === liker.id;

              return (
                <div
                  key={liker.id}
                  className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 flex flex-col"
                >
                  <div className="relative w-full aspect-[3/4] bg-gray-200">
                    <img
                      src={photo}
                      alt={liker.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent text-white">
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-bold">{liker.name}</span>
                        {liker.age && (
                          <span className="text-xs opacity-90">
                            {liker.age}
                          </span>
                        )}
                      </div>
                      {liker.city && (
                        <p className="text-[10px] text-white/80 mt-0.5">
                          {liker.city}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex p-2 gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleSkip(liker)}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold py-2 rounded-xl transition disabled:opacity-50"
                    >
                      Скип
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleLikeBack(liker)}
                      className="flex-1 bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold py-2 rounded-xl transition disabled:opacity-50"
                    >
                      Лайк
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
