"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Profile {
  id: string;
  name: string;
  age?: number;
  bio?: string;
  city?: string;
  occupation?: string;
  interests?: string[];
  avatar_url?: string;
  avatar?: string;
  // Новые поля анкеты
  dating_goal?: string; // "Я здесь для..."
  worldview?: string; // Мировоззрение
  zodiac_sign?: string; // Знак зодиака
  height?: number; // Рост, см
  education?: string; // Образование
  children?: string; // Дети
  languages?: string[]; // Языки
  alcohol?: string; // Алкоголь
  smoking?: string; // Курение
}

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Ошибка при загрузке профиля:", error);
      } else if (data) {
        setProfile(data);
      }

      // Загружаем дополнительные фото из таблицы photos
      const { data: photosData } = await supabase
        .from("photos")
        .select("url")
        .eq("profile_id", user.id)
        .order("position", { ascending: true });

      const mainAvatar = data?.avatar_url || data?.avatar;
      const additionalUrls = photosData?.map((p) => p.url) || [];

      const allPhotos = Array.from(
        new Set([...(mainAvatar ? [mainAvatar] : []), ...additionalUrls])
      );

      setPhotos(
        allPhotos.length > 0
          ? allPhotos
          : ["https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1000"]
      );

      setIsLoading(false);
    };

    loadProfile();
  }, []);

  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
  };

  const prevPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center text-xs text-gray-400 animate-pulse">
        Загрузка профиля...
      </div>
    );
  }

  // Список деталей анкеты в духе "Мировоззрение / Знак зодиака / Рост..."
  const detailRows: { label: string; value: string }[] = [];

  if (profile?.city) detailRows.push({ label: "Город", value: profile.city });
  if (profile?.worldview) detailRows.push({ label: "Мировоззрение", value: profile.worldview });
  if (profile?.zodiac_sign) detailRows.push({ label: "Знак зодиака", value: profile.zodiac_sign });
  if (profile?.height) detailRows.push({ label: "Рост", value: profile.height + " см" });
  if (profile?.education) detailRows.push({ label: "Образование", value: profile.education });
  if (profile?.children) detailRows.push({ label: "Дети", value: profile.children });
  if (profile?.languages && profile.languages.length > 0)
    detailRows.push({ label: "Языки", value: profile.languages.join(", ") });
  if (profile?.alcohol) detailRows.push({ label: "Алкоголь", value: profile.alcohol });
  if (profile?.smoking) detailRows.push({ label: "Курение", value: profile.smoking });

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-800 flex flex-col items-center pb-8 select-none">
      <header className="w-full max-w-md px-6 h-16 flex items-center justify-between border-b border-gray-100 bg-white sticky top-0 z-20">
        <Link href="/discover" className="text-xs font-bold text-gray-500 hover:text-gray-900 transition">
          ← К анкетам
        </Link>
        <span className="text-sm font-black tracking-wider text-gray-900">МОЙ ПРОФИЛЬ</span>
        <button
          onClick={handleSignOut}
          className="text-xs font-bold text-rose-500 hover:text-rose-700 transition cursor-pointer"
        >
          Выйти
        </button>
      </header>

      <main className="w-full max-w-md flex-1 bg-white shadow-sm overflow-hidden flex flex-col">
        <div className="relative w-full h-[420px] bg-black">
          <img
            src={photos[currentPhotoIndex]}
            alt={profile?.name || "Профиль"}
            className="w-full h-full object-cover transition-all duration-300"
          />

          {photos.length > 1 && (
            <div className="absolute top-3 left-3 right-3 flex gap-1.5 z-10">
              {photos.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1 flex-1 rounded-full transition-all ${
                    idx === currentPhotoIndex ? "bg-white" : "bg-white/40"
                  }`}
                />
              ))}
            </div>
          )}

          {photos.length > 1 && (
            <>
              <button
                onClick={prevPhoto}
                className="absolute left-0 top-0 bottom-0 w-1/3 z-10 flex items-center justify-start pl-3 text-white/70 hover:text-white transition group cursor-pointer"
                aria-label="Предыдущее фото"
              >
                <span className="bg-black/30 backdrop-blur-md rounded-full w-8 h-8 flex items-center justify-center group-hover:scale-110 transition">
                  ‹
                </span>
              </button>
              <button
                onClick={nextPhoto}
                className="absolute right-0 top-0 bottom-0 w-1/3 z-10 flex items-center justify-end pr-3 text-white/70 hover:text-white transition group cursor-pointer"
                aria-label="Следующее фото"
              >
                <span className="bg-black/30 backdrop-blur-md rounded-full w-8 h-8 flex items-center justify-center group-hover:scale-110 transition">
                  ›
                </span>
              </button>
            </>
          )}

          <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white pointer-events-none">
            <div className="flex items-baseline gap-2">
              <h1 className="text-2xl font-black">{profile?.name || "Без имени"}</h1>
              {profile?.age && <span className="text-xl font-medium opacity-90">{profile.age}</span>}
            </div>
            {profile?.city && (
              <p className="text-xs text-white/80 mt-1 flex items-center gap-1">
                📍 {profile.city}
              </p>
            )}
          </div>
        </div>

        <div className="p-6 space-y-6">
          {profile?.dating_goal && (
            <div className="flex items-center gap-2 text-xs font-bold text-pink-700 bg-pink-50 p-3 rounded-xl border border-pink-100">
              <span>💗</span>
              <span>Я здесь для: {profile.dating_goal}</span>
            </div>
          )}

          {profile?.occupation && (
            <div className="flex items-center gap-2 text-xs font-medium text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100">
              <span>💼</span>
              <span>{profile.occupation}</span>
            </div>
          )}

          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              О себе
            </h3>
            <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">
              {profile?.bio || "Описание пока не заполнено."}
            </p>
          </div>

          {profile?.interests && profile.interests.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">
                Интересы
              </h3>
              <div className="flex flex-wrap gap-2">
                {profile.interests.map((interest, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-pink-50 text-pink-600 border border-pink-100"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          )}

          {detailRows.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">
                Подробнее
              </h3>
              <div className="rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                {detailRows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between px-4 py-3 text-xs"
                  >
                    <span className="text-gray-400 font-medium">{row.label}</span>
                    <span className="text-gray-800 font-bold">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-gray-100 flex gap-3">
            <Link
              href="/profile/edit"
              className="flex-1 bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 rounded-2xl text-xs text-center transition shadow-sm"
            >
              Редактировать профиль
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
