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
  bio?: string;
  interests?: string[];
  avatar_url?: string;
  avatar?: string;
  likeId: number;
  likedAt: string;
}

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return "только что";
  if (minutes < 60) return minutes + " мин назад";

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + " ч назад";

  const days = Math.floor(hours / 24);
  if (days < 7) return days + " дн назад";

  return new Date(dateStr).toLocaleDateString("ru-RU");
}

export default function LikesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [likers, setLikers] = useState<LikerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [matchedName, setMatchedName] = useState<string | null>(null);

  // Детальный просмотр анкеты по тапу
  const [selectedLiker, setSelectedLiker] = useState<LikerProfile | null>(null);
  const [modalPhotos, setModalPhotos] = useState<string[]>([]);
  const [modalPhotoIndex, setModalPhotoIndex] = useState(0);
  const [isLoadingModalPhotos, setIsLoadingModalPhotos] = useState(false);

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
        .select("id, name, age, city, bio, interests, avatar_url, avatar")
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
          return {
            ...profile,
            interests: Array.isArray((profile as any).interests)
              ? (profile as any).interests.filter(Boolean)
              : [],
            likeId: like.id,
            likedAt: like.created_at,
          } as LikerProfile;
        })
        .filter(Boolean) as LikerProfile[];

      setLikers(merged);
      setIsLoading(false);
    };

    loadLikes();
  }, []);

  // Подгружаем дополнительные фото при открытии детальной карточки
  useEffect(() => {
    if (!selectedLiker) {
      setModalPhotos([]);
      setModalPhotoIndex(0);
      return;
    }

    const loadModalPhotos = async () => {
      setIsLoadingModalPhotos(true);
      setModalPhotoIndex(0);

      const mainPhoto =
        selectedLiker.avatar_url ||
        selectedLiker.avatar ||
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800";

      const { data: photosData } = await supabase
        .from("photos")
        .select("url")
        .eq("profile_id", selectedLiker.id)
        .order("position", { ascending: true });

      const extra = (photosData || []).map((p) => p.url);
      const unique = Array.from(new Set([mainPhoto, ...extra]));

      setModalPhotos(unique);
      setIsLoadingModalPhotos(false);
    };

    loadModalPhotos();
  }, [selectedLiker]);

  const ensureMatchExists = async (myId: string, otherId: string) => {
    const { data: existing, error: findError } = await supabase
      .from("matches")
      .select("id")
      .or(
        "and(user1_id.eq." + myId + ",user2_id.eq." + otherId + ")," +
        "and(user1_id.eq." + otherId + ",user2_id.eq." + myId + ")"
      )
      .maybeSingle();

    if (findError) {
      console.error("Ошибка проверки существующего мэтча:", findError);
      return;
    }

    if (existing) return;

    const { error: insertError } = await supabase.from("matches").insert({
      user1_id: myId,
      user2_id: otherId,
    });

    if (insertError) {
      console.error("Ошибка создания мэтча:", insertError);
    }
  };

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

    await ensureMatchExists(user.id, liker.id);

    setLikers((prev) => prev.filter((l) => l.id !== liker.id));
    setMatchedName(liker.name);
    setRespondingId(null);
    if (selectedLiker?.id === liker.id) setSelectedLiker(null);
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
    if (selectedLiker?.id === liker.id) setSelectedLiker(null);
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
          <div className="bg-pink-50 border border-pink-100 text-pink-600 text-xs font-semibold rounded-2xl p-3 text-center flex items-center justify-between gap-2">
            <span>
              {"\u2764\ufe0f \u042d\u0442\u043e \u043c\u044d\u0442\u0447! \u0412\u044b \u0438 " +
                matchedName +
                " \u043f\u043e\u043d\u0440\u0430\u0432\u0438\u043b\u0438\u0441\u044c \u0434\u0440\u0443\u0433 \u0434\u0440\u0443\u0433\u0443"}
            </span>
            <Link
              href="/matches"
              className="shrink-0 bg-pink-500 hover:bg-pink-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl transition"
            >
              Смотреть мэтчи
            </Link>
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
                  <button
                    type="button"
                    onClick={() => setSelectedLiker(liker)}
                    className="relative w-full aspect-[3/4] bg-gray-200 cursor-pointer"
                  >
                    <img
                      src={photo}
                      alt={liker.name}
                      className="w-full h-full object-cover"
                    />

                    <span className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-1 rounded-full">
                      {formatRelativeTime(liker.likedAt)}
                    </span>

                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 via-black/30 to-transparent text-white text-left">
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
                      {liker.bio && (
                        <p className="text-[10px] text-white/70 mt-1 line-clamp-2">
                          {liker.bio}
                        </p>
                      )}
                    </div>
                  </button>

                  {liker.interests && liker.interests.length > 0 && (
                    <div className="flex flex-wrap gap-1 px-2.5 pt-2">
                      {liker.interests.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="bg-pink-50 text-pink-600 text-[9px] font-bold px-2 py-0.5 rounded-lg"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex p-2 gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleSkip(liker)}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold py-2 rounded-xl transition disabled:opacity-50 cursor-pointer"
                    >
                      Скип
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleLikeBack(liker)}
                      className="flex-1 bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold py-2 rounded-xl transition disabled:opacity-50 cursor-pointer"
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

      {/* МОДАЛКА С ПОЛНОЙ АНКЕТОЙ */}
      {selectedLiker && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedLiker(null)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-sm max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full aspect-[3/4] bg-gray-900">
              {isLoadingModalPhotos ? (
                <div className="w-full h-full flex items-center justify-center text-white/50 text-xs">
                  Загрузка фото...
                </div>
              ) : (
                <img
                  src={modalPhotos[modalPhotoIndex]}
                  alt={selectedLiker.name}
                  className="w-full h-full object-cover"
                />
              )}

              {modalPhotos.length > 1 && (
                <div className="absolute top-3 left-3 right-3 flex gap-1.5 z-10">
                  {modalPhotos.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-1 flex-1 rounded-full transition-all ${
                        idx === modalPhotoIndex ? "bg-white" : "bg-white/30"
                      }`}
                    />
                  ))}
                </div>
              )}

              {modalPhotos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setModalPhotoIndex((prev) => Math.max(prev - 1, 0))
                    }
                    className="absolute left-0 top-0 bottom-0 w-1/3 cursor-pointer"
                    aria-label="Предыдущее фото"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setModalPhotoIndex((prev) =>
                        Math.min(prev + 1, modalPhotos.length - 1)
                      )
                    }
                    className="absolute right-0 top-0 bottom-0 w-1/3 cursor-pointer"
                    aria-label="Следующее фото"
                  />
                </>
              )}

              <button
                type="button"
                onClick={() => setSelectedLiker(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center text-sm font-bold cursor-pointer z-10"
              >
                ✕
              </button>

              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/85 via-black/30 to-transparent text-white">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-xl font-black">{selectedLiker.name}</h2>
                  {selectedLiker.age && (
                    <span className="text-base opacity-90">{selectedLiker.age}</span>
                  )}
                </div>
                {selectedLiker.city && (
                  <p className="text-xs text-white/80 mt-0.5">📍 {selectedLiker.city}</p>
                )}
                <p className="text-[10px] text-pink-200 font-bold mt-1">
                  💗 Лайкнул(а) вас {formatRelativeTime(selectedLiker.likedAt)}
                </p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {selectedLiker.bio && (
                <div>
                  <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    О себе
                  </h3>
                  <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">
                    {selectedLiker.bio}
                  </p>
                </div>
              )}

              {selectedLiker.interests && selectedLiker.interests.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Интересы
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedLiker.interests.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1.5 rounded-full text-xs font-medium bg-pink-50 text-pink-600 border border-pink-100"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={respondingId === selectedLiker.id}
                  onClick={() => handleSkip(selectedLiker)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold py-3 rounded-2xl transition disabled:opacity-50 cursor-pointer"
                >
                  Скип
                </button>
                <button
                  type="button"
                  disabled={respondingId === selectedLiker.id}
                  onClick={() => handleLikeBack(selectedLiker)}
                  className="flex-1 bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold py-3 rounded-2xl transition disabled:opacity-50 cursor-pointer"
                >
                  Лайкнуть в ответ 💗
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
