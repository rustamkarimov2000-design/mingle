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
  gender?: string;
  interests?: string[];
  avatar_url?: string;
  avatar?: string;
  createdAt: string | null;
}

const DEFAULT_MIN_AGE = 18;
const DEFAULT_MAX_AGE = 99;

export default function MatchesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [matches, setMatches] = useState<MatchProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedCity, setSelectedCity] = useState("Все");
  const [selectedGender, setSelectedGender] = useState("Все");
  const [selectedInterest, setSelectedInterest] = useState("Все");
  const [minAge, setMinAge] = useState(DEFAULT_MIN_AGE);
  const [maxAge, setMaxAge] = useState(DEFAULT_MAX_AGE);

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

      // select("*") — берём все поля профиля, чтобы не сломать запрос,
      // если в таблице ещё нет колонок gender/interests
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", otherIds);

      if (profilesError) {
        console.error("Ошибка загрузки профилей мэтчей:", profilesError);
        setIsLoading(false);
        return;
      }

      const merged = matchesData
        .map((m) => {
          const otherId = m.user1_id === user.id ? m.user2_id : m.user1_id;
          const profile = profilesData?.find((p: any) => p.id === otherId);
          if (!profile) return null;

          return {
            matchId: m.id,
            userId: otherId,
            name: profile.name,
            age: profile.age,
            city: profile.city,
            gender: profile.gender || undefined,
            interests: Array.isArray(profile.interests)
              ? profile.interests.filter(Boolean)
              : [],
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

  // Динамические списки фильтров на основе реально загруженных мэтчей
  const cityOptions = [
    "Все",
    ...Array.from(new Set(matches.map((m) => m.city).filter(Boolean) as string[])),
  ];
  const genderOptions = [
    "Все",
    ...Array.from(new Set(matches.map((m) => m.gender).filter(Boolean) as string[])),
  ];
  const interestOptions = [
    "Все",
    ...Array.from(new Set(matches.flatMap((m) => m.interests || []))),
  ];

  const resetFilters = () => {
    setSelectedCity("Все");
    setSelectedGender("Все");
    setSelectedInterest("Все");
    setMinAge(DEFAULT_MIN_AGE);
    setMaxAge(DEFAULT_MAX_AGE);
  };

  const filteredMatches = matches.filter((m) => {
    const cityMatch = selectedCity === "Все" || m.city === selectedCity;
    const genderMatch = selectedGender === "Все" || m.gender === selectedGender;
    const interestMatch =
      selectedInterest === "Все" || (m.interests || []).includes(selectedInterest);
    const ageMatch = !m.age || (m.age >= minAge && m.age <= maxAge);

    return cityMatch && genderMatch && interestMatch && ageMatch;
  });

  const filtersActive =
    selectedCity !== "Все" ||
    selectedGender !== "Все" ||
    selectedInterest !== "Все" ||
    minAge !== DEFAULT_MIN_AGE ||
    maxAge !== DEFAULT_MAX_AGE;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6">
        <div className="grid flex-1 grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <aside className="hidden lg:sticky lg:top-20 lg:block lg:col-span-3">
            <Sidebar />
          </aside>

          <section className="col-span-1 lg:col-span-9 space-y-6">
            <h1 className="text-2xl font-black text-gray-900">
              Ваши мэтчи ✨
            </h1>

            {matches.length > 0 && (
              <div className="rounded-3xl border bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-black uppercase tracking-wider text-gray-900 flex items-center gap-2">
                    ⚙️ Фильтры
                  </h2>
                  <button
                    onClick={resetFilters}
                    className="text-[11px] font-bold text-pink-600 hover:underline cursor-pointer"
                  >
                    Сбросить
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-gray-400 font-medium mb-1.5 text-[11px]">Город:</label>
                    <div className="flex flex-wrap gap-2">
                      {cityOptions.map((city) => (
                        <button
                          key={city}
                          onClick={() => setSelectedCity(city)}
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
                    <label className="block text-gray-400 font-medium mb-1.5 text-[11px]">Пол:</label>
                    <div className="flex flex-wrap gap-2">
                      {genderOptions.length > 1 ? (
                        genderOptions.map((gender) => (
                          <button
                            key={gender}
                            onClick={() => setSelectedGender(gender)}
                            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                              selectedGender === gender
                                ? "bg-black text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                          >
                            {gender}
                          </button>
                        ))
                      ) : (
                        <span className="text-[11px] text-gray-300 italic">
                          Нет данных о поле
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-400 font-medium mb-1.5 text-[11px]">
                      Возраст: {minAge}–{maxAge}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={DEFAULT_MIN_AGE}
                        max={maxAge}
                        value={minAge}
                        onChange={(e) =>
                          setMinAge(Math.min(Number(e.target.value) || DEFAULT_MIN_AGE, maxAge))
                        }
                        className="w-16 rounded-xl border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:border-pink-300"
                      />
                      <span className="text-gray-300">—</span>
                      <input
                        type="number"
                        min={minAge}
                        max={DEFAULT_MAX_AGE}
                        value={maxAge}
                        onChange={(e) =>
                          setMaxAge(Math.max(Number(e.target.value) || DEFAULT_MAX_AGE, minAge))
                        }
                        className="w-16 rounded-xl border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:border-pink-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-400 font-medium mb-1.5 text-[11px]">Интерес:</label>
                    <div className="flex flex-wrap gap-2">
                      {interestOptions.length > 1 ? (
                        interestOptions.map((tag) => (
                          <button
                            key={tag}
                            onClick={() => setSelectedInterest(tag)}
                            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                              selectedInterest === tag
                                ? "bg-pink-600 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                          >
                            {tag === "Все" ? tag : "#" + tag}
                          </button>
                        ))
                      ) : (
                        <span className="text-[11px] text-gray-300 italic">
                          Нет данных об интересах
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

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
            ) : filteredMatches.length === 0 ? (
              <div className="rounded-3xl border bg-white p-8 text-center shadow-sm space-y-3">
                <p className="text-sm text-gray-500">
                  {filtersActive
                    ? "Под выбранные фильтры мэтчи не найдены."
                    : "Мэтчи не найдены."}
                </p>
                <button
                  onClick={resetFilters}
                  className="inline-block rounded-2xl bg-pink-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-700 cursor-pointer"
                >
                  Сбросить фильтры ↺
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMatches.map((match) => {
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

                        {match.interests && match.interests.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {match.interests.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="rounded-lg bg-pink-50 px-2 py-0.5 text-[10px] font-medium text-pink-600"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
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
