"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

interface Candidate {
  id: string;
  name: string;
  age: number;
  city: string;
  bio: string;
  avatar: string;
  photos: string[];
  interests: string[];
  distanceKm: number | null;
}

export default function DiscoverPage() {
  const [selectedCity, setSelectedCity] = useState("Все");
  const [selectedInterest, setSelectedInterest] = useState("Все");
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedUser, setMatchedUser] = useState<Candidate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(0);

  const [myAvatar, setMyAvatar] = useState(
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150"
  );

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    loadCandidates();
  }, []);

  async function loadCandidates() {
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIsLoading(false);
      return;
    }

    const { data: myProfile } = await supabase
      .from("profiles")
      .select("avatar, latitude, longitude")
      .eq("id", user.id)
      .single();

    if (myProfile?.avatar) {
      setMyAvatar(myProfile.avatar);
    }

    const myLat = myProfile?.latitude;
    const myLon = myProfile?.longitude;

    // Загружаем ID всех, кого мы уже лайкнули
    const { data: alreadyLiked } = await supabase
      .from("likes")
      .select("to_user_id")
      .eq("from_user_id", user.id);

    const likedIds = alreadyLiked?.map((l) => l.to_user_id) || [];

    let query = supabase.from("profiles").select("*").neq("id", user.id);

    if (likedIds.length > 0) {
      query = query.not("id", "in", `(${likedIds.join(",")})`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Ошибка загрузки анкет:", error);
      setIsLoading(false);
      return;
    }

    const candidateIds = data?.map((p) => p.id) || [];

    const { data: allPhotos } = await supabase
      .from("photos")
      .select("profile_id, url")
      .in("profile_id", candidateIds)
      .order("position", { ascending: true });

    const people: Candidate[] =
      data?.map((profile) => {
        const mainPhoto =
          profile.avatar ||
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600";

        const extraPhotos =
          allPhotos?.filter((p) => p.profile_id === profile.id).map((p) => p.url) || [];

        const uniquePhotos = Array.from(new Set([mainPhoto, ...extraPhotos]));

        const distanceKm =
          myLat && myLon && profile.latitude && profile.longitude
            ? calculateDistance(myLat, myLon, profile.latitude, profile.longitude)
            : null;

        return {
          id: profile.id,
          name: profile.name || "Без имени",
          age: profile.age || 18,
          city: profile.city || "Не указан",
          bio: profile.bio || "Пока ничего не рассказал о себе 😊",
          avatar: mainPhoto,
          photos: uniquePhotos,
          interests: ["Mingle"],
          distanceKm,
        };
      }) || [];

    setCandidates(people);
    setIsLoading(false);
  }

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-18, 18]);
  const likeOpacity = useTransform(x, [10, 100], [0, 1]);
  const dislikeOpacity = useTransform(x, [-10, -100], [0, 1]);

  const filteredCandidates = candidates.filter((user) => {
    const cityMatch = selectedCity === "Все" || user.city === selectedCity;
    const interestMatch =
      selectedInterest === "Все" || user.interests.includes(selectedInterest);
    return cityMatch && interestMatch;
  });

  const currentCandidate = filteredCandidates[currentIndex];

  useEffect(() => {
    setPhotoIndex(0);
  }, [currentCandidate?.id]);

  const triggerConfetti = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#E02868", "#FF85A1", "#FFD166", "#06D6A0"],
    });
  };

  const nextCandidate = () => {
    x.set(0);
    setPhotoIndex(0);
    setCurrentIndex((prev) => prev + 1);
  };

  const handleSwipe = async (direction: "like" | "dislike") => {
    if (!currentCandidate) return;

    if (direction === "dislike") {
      nextCandidate();
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      nextCandidate();
      return;
    }

    // 1. Проверяем, лайкал ли нас этот кандидат РАНЕЕ (встречный лайк)
    const { data: reciprocalLike } = await supabase
      .from("likes")
      .select("id")
      .eq("from_user_id", currentCandidate.id)
      .eq("to_user_id", user.id)
      .maybeSingle();

    // 2. Отправляем наш лайк
    const { error: likeError } = await supabase.from("likes").insert({
      from_user_id: user.id,
      to_user_id: currentCandidate.id,
    });

    if (likeError) {
      console.error("Ошибка сохранения лайка:", likeError);
      nextCandidate();
      return;
    }

    // 3. Если был встречный лайк, создаем запись в matches (если базы нет автоматических триггеров)
    if (reciprocalLike) {
      await supabase.from("matches").insert([
        { user1_id: user.id, user2_id: currentCandidate.id }
      ]).select().maybeSingle();

      triggerConfetti();
      setMatchedUser(currentCandidate);
      setShowMatchModal(true);
    } else {
      nextCandidate();
    }
  };

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 120) {
      handleSwipe("like");
    } else if (info.offset.x < -120) {
      handleSwipe("dislike");
    }
  };

  const nextPhoto = () => {
    if (!currentCandidate) return;
    setPhotoIndex((prev) =>
      prev < currentCandidate.photos.length - 1 ? prev + 1 : prev
    );
  };

  const prevPhoto = () => {
    setPhotoIndex((prev) => (prev > 0 ? prev - 1 : prev));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">
        Загрузка анкет...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-800 font-sans pb-12 overflow-x-hidden">
      <header className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xl font-black tracking-wider text-gray-900">
            MINGLE
          </Link>
          <span className="text-xs text-gray-400 font-medium">/ мэтчи и поиск</span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/messages"
            className="text-xs font-bold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 px-4 py-2 rounded-full shadow-xs"
          >
            Сообщения 💬
          </Link>
          <Link
            href="/profile"
            className="text-xs font-bold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 px-4 py-2 rounded-full shadow-xs"
          >
            Профиль
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pt-4 space-y-6">
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-gray-100 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-gray-900 flex items-center gap-2">
              ⚙️ Фильтры поиска
            </h2>
            <button
              onClick={() => {
                setSelectedCity("Все");
                setSelectedInterest("Все");
                setCurrentIndex(0);
                setPhotoIndex(0);
              }}
              className="text-[11px] font-bold text-pink-600 hover:underline cursor-pointer"
            >
              Сбросить
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-gray-400 font-medium mb-1.5 text-[11px]">Город:</label>
              <div className="flex flex-wrap gap-2">
                {["Все", "Москва", "Санкт-Петербург"].map((city) => (
                  <button
                    key={city}
                    onClick={() => {
                      setSelectedCity(city);
                      setCurrentIndex(0);
                      setPhotoIndex(0);
                    }}
                    className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                      selectedCity === city
                        ? "bg-black text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-gray-400 font-medium mb-1.5 text-[11px]">Интерес:</label>
              <div className="flex flex-wrap gap-2">
                {["Все", "Кофе", "Искусство", "ИТ", "Настолки"].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      setSelectedInterest(tag);
                      setCurrentIndex(0);
                      setPhotoIndex(0);
                    }}
                    className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                      selectedInterest === tag
                        ? "bg-[#E02868] text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-md mx-auto relative h-[520px] flex items-center justify-center">
          <AnimatePresence>
            {currentCandidate ? (
              <motion.div
                key={currentCandidate.id}
                style={{ x, rotate }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={handleDragEnd}
                whileTap={{ cursor: "grabbing" }}
                className="absolute w-full h-full rounded-3xl overflow-hidden bg-gray-900 shadow-2xl cursor-grab select-none touch-none"
              >
                <motion.div
                  style={{ opacity: likeOpacity }}
                  className="absolute top-8 left-8 z-20 border-4 border-emerald-400 text-emerald-400 font-black text-3xl px-4 py-1 rounded-2xl rotate-[-15deg] uppercase tracking-wider"
                >
                  LIKE
                </motion.div>

                <motion.div
                  style={{ opacity: dislikeOpacity }}
                  className="absolute top-8 right-8 z-20 border-4 border-red-500 text-red-500 font-black text-3xl px-4 py-1 rounded-2xl rotate-[15deg] uppercase tracking-wider"
                >
                  NOPE
                </motion.div>

                {currentCandidate.photos.length > 1 && (
                  <div className="absolute top-3 left-3 right-3 flex gap-1.5 z-20 pointer-events-none">
                    {currentCandidate.photos.map((_, idx) => (
                      <div
                        key={idx}
                        className={`h-1 flex-1 rounded-full transition-all ${
                          idx === photoIndex ? "bg-white" : "bg-white/30"
                        }`}
                      />
                    ))}
                  </div>
                )}

                {currentCandidate.photos.length > 1 && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        prevPhoto();
                      }}
                      className="absolute left-0 top-0 w-1/2 h-2/3 z-10 cursor-pointer"
                      aria-label="Предыдущее фото"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        nextPhoto();
                      }}
                      className="absolute right-0 top-0 w-1/2 h-2/3 z-10 cursor-pointer"
                      aria-label="Следующее фото"
                    />
                  </>
                )}

                <img
                  src={currentCandidate.photos[photoIndex] || currentCandidate.avatar}
                  alt={currentCandidate.name}
                  className="w-full h-full object-cover pointer-events-none"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent p-6 flex flex-col justify-end text-white space-y-3 pointer-events-none">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-black">
                      {currentCandidate.name}, {currentCandidate.age}
                    </h3>
                    <span className="bg-white/20 text-xs font-bold px-3 py-1 rounded-full backdrop-blur-md">
                      📍 {currentCandidate.city}
                      {currentCandidate.distanceKm !== null && ` · ${currentCandidate.distanceKm} км`}
                    </span>
                  </div>

                  <p className="text-xs text-gray-200 leading-relaxed">
                    {currentCandidate.bio}
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {currentCandidate.interests.map((tag) => (
                      <span
                        key={tag}
                        className="bg-white/10 text-[11px] px-3 py-1 rounded-xl border border-white/20 font-medium"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-center gap-6 pt-4 pointer-events-auto">
                    <button
                      onClick={() => handleSwipe("dislike")}
                      className="w-14 h-14 rounded-full bg-white/90 text-red-500 hover:bg-white hover:scale-110 font-bold text-2xl shadow-xl flex items-center justify-center transition cursor-pointer"
                    >
                      ❌
                    </button>
                    <button
                      onClick={() => handleSwipe("like")}
                      className="w-16 h-16 rounded-full bg-[#E02868] text-white hover:bg-pink-500 hover:scale-110 font-bold text-3xl shadow-xl flex items-center justify-center transition cursor-pointer"
                    >
                      ❤️
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 space-y-4 shadow-sm w-full">
                <span className="text-5xl block">🎉</span>
                <h3 className="text-lg font-black text-gray-900">Анкеты закончились</h3>
                <p className="text-xs text-gray-400">Попробуйте сбросить фильтры или зайти позже.</p>
                <button
                  onClick={() => {
                    setSelectedCity("Все");
                    setSelectedInterest("Все");
                    setCurrentIndex(0);
                    setPhotoIndex(0);
                  }}
                  className="bg-[#E02868] text-white text-xs font-bold px-6 py-3 rounded-2xl shadow-md hover:bg-pink-600 transition cursor-pointer"
                >
                  Сбросить фильтры ↺
                </button>
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {showMatchModal && matchedUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-gradient-to-b from-pink-600 to-purple-700 rounded-3xl p-8 max-w-sm w-full text-center text-white space-y-6 shadow-2xl relative border border-white/20">
            <div className="space-y-2">
              <span className="text-xs uppercase tracking-widest font-extrabold text-pink-200">
                Это взаимно!
              </span>
              <h2 className="text-4xl font-black italic tracking-wider">IT'S A MATCH!</h2>
            </div>

            <div className="flex items-center justify-center -space-x-4 py-2">
              <div className="w-20 h-20 rounded-full border-4 border-white overflow-hidden shadow-lg">
                <img src={myAvatar} alt="Вы" className="w-full h-full object-cover" />
              </div>
              <div className="w-20 h-20 rounded-full border-4 border-white overflow-hidden shadow-lg z-10">
                <img
                  src={matchedUser.avatar}
                  alt={matchedUser.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <p className="text-xs text-pink-100 leading-relaxed">
              Вы понравились друг другу с <span className="font-bold text-white">{matchedUser.name}</span>!
            </p>

            <div className="space-y-2">
              <Link
                href="/messages"
                className="block w-full bg-white text-pink-600 font-black py-3 rounded-2xl text-xs hover:bg-pink-50 transition shadow-md"
              >
                Написать сообщение 💬
              </Link>
              <button
                onClick={() => {
                  setShowMatchModal(false);
                  nextCandidate();
                }}
                className="w-full bg-white/20 hover:bg-white/30 text-white font-bold py-3 rounded-2xl text-xs transition cursor-pointer"
              >
                Продолжить свайпать 🔥
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}