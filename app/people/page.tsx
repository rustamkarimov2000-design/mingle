"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/client";

interface Person {
  id: string;
  name: string;
  age?: number;
  city?: string;
  gender?: string;
  interests?: string[];
  bio?: string;
  avatar_url?: string;
  avatar?: string;
  last_seen?: string;
}

type RelationStatus = "none" | "liked" | "matched";

const DEFAULT_MIN_AGE = 18;
const DEFAULT_MAX_AGE = 99;

export default function PeoplePage() {
  const router = useRouter();
  const supabase = createClient();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [relations, setRelations] = useState<Record<string, RelationStatus>>({});
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [selectedCity, setSelectedCity] = useState("Все");
  const [selectedGender, setSelectedGender] = useState("Все");
  const [selectedInterest, setSelectedInterest] = useState("Все");
  const [minAge, setMinAge] = useState(DEFAULT_MIN_AGE);
  const [maxAge, setMaxAge] = useState(DEFAULT_MAX_AGE);

  const getAvatar = (p: Person) =>
    p.avatar_url ||
    p.avatar ||
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500";

  const isOnline = (lastSeen?: string) => {
    if (!lastSeen) return false;
    const diffMinutes = (Date.now() - new Date(lastSeen).getTime()) / 60000;
    return diffMinutes < 5;
  };

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
        return;
      }

      setCurrentUserId(user.id);

      // select("*") — берём все поля профиля, чтобы не сломать запрос,
      // если в таблице ещё нет колонок gender/interests
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", user.id);

      if (profilesError) {
        console.error("Ошибка загрузки людей:", profilesError);
        setIsLoading(false);
        return;
      }

      const normalized: Person[] = (profilesData || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        age: p.age,
        city: p.city,
        gender: p.gender || undefined,
        interests: Array.isArray(p.interests) ? p.interests.filter(Boolean) : [],
        bio: p.bio,
        avatar_url: p.avatar_url,
        avatar: p.avatar,
        last_seen: p.last_seen,
      }));

      setPeople(normalized);

      const [matches1Res, matches2Res, likesRes] = await Promise.all([
        supabase.from("matches").select("user2_id").eq("user1_id", user.id),
        supabase.from("matches").select("user1_id").eq("user2_id", user.id),
        supabase.from("likes").select("to_user_id").eq("from_user_id", user.id),
      ]);

      const matchedIds = new Set<string>([
        ...(matches1Res.data || []).map((m) => m.user2_id),
        ...(matches2Res.data || []).map((m) => m.user1_id),
      ]);

      const likedIds = new Set<string>(
        (likesRes.data || []).map((l) => l.to_user_id)
      );

      const relationMap: Record<string, RelationStatus> = {};
      normalized.forEach((p) => {
        if (matchedIds.has(p.id)) {
          relationMap[p.id] = "matched";
        } else if (likedIds.has(p.id)) {
          relationMap[p.id] = "liked";
        } else {
          relationMap[p.id] = "none";
        }
      });

      setRelations(relationMap);
      setIsLoading(false);
    };

    load();
  }, []);

  const handleLike = async (person: Person) => {
    if (!currentUserId) return;
    setBusyId(person.id);

    const { error } = await supabase.from("likes").insert({
      from_user_id: currentUserId,
      to_user_id: person.id,
    });

    if (error) {
      console.error("Ошибка отправки лайка:", error);
      setBusyId(null);
      return;
    }

    const { data: theyLikedMe } = await supabase
      .from("likes")
      .select("id")
      .eq("from_user_id", person.id)
      .eq("to_user_id", currentUserId)
      .maybeSingle();

    if (theyLikedMe) {
      const { error: matchError } = await supabase.from("matches").insert({
        user1_id: currentUserId,
        user2_id: person.id,
      });

      if (matchError) {
        console.error("Ошибка создания мэтча:", matchError);
      }

      setRelations((prev) => ({ ...prev, [person.id]: "matched" }));
    } else {
      setRelations((prev) => ({ ...prev, [person.id]: "liked" }));
    }

    setBusyId(null);
  };

  const handleOpenChat = (person: Person) => {
    router.push(`/messages?userId=${person.id}`);
  };

  // Динамические списки фильтров на основе реально загруженных анкет
  const cityOptions = [
    "Все",
    ...Array.from(new Set(people.map((p) => p.city).filter(Boolean) as string[])),
  ];
  const genderOptions = [
    "Все",
    ...Array.from(new Set(people.map((p) => p.gender).filter(Boolean) as string[])),
  ];
  const interestOptions = [
    "Все",
    ...Array.from(new Set(people.flatMap((p) => p.interests || []))),
  ];

  const resetFilters = () => {
    setSelectedCity("Все");
    setSelectedGender("Все");
    setSelectedInterest("Все");
    setMinAge(DEFAULT_MIN_AGE);
    setMaxAge(DEFAULT_MAX_AGE);
  };

  const filteredPeople = people.filter((person) => {
    const searchMatch =
      (person.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (person.city || "").toLowerCase().includes(search.toLowerCase());
    const cityMatch = selectedCity === "Все" || person.city === selectedCity;
    const genderMatch = selectedGender === "Все" || person.gender === selectedGender;
    const interestMatch =
      selectedInterest === "Все" || (person.interests || []).includes(selectedInterest);
    const ageMatch = !person.age || (person.age >= minAge && person.age <= maxAge);

    return searchMatch && cityMatch && genderMatch && interestMatch && ageMatch;
  });

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6">
        <div className="grid flex-1 grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <aside className="hidden lg:sticky lg:top-20 lg:block lg:col-span-3">
            <Sidebar />
          </aside>

          <section className="col-span-1 space-y-6 lg:col-span-9">
            <div className="rounded-3xl border bg-white p-6 shadow-sm space-y-4">
              <h1 className="text-2xl font-bold text-gray-900">
                Знакомства в Mingle
              </h1>
              <input
                type="text"
                placeholder="Поиск по имени или городу..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-2xl border bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-pink-500 focus:bg-white"
              />

              <div className="pt-2 border-t border-gray-100 space-y-3">
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
                          Нет данных о поле в анкетах
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
                          Нет данных об интересах в анкетах
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="rounded-3xl border bg-white p-8 text-center text-sm text-gray-400">
                Загрузка анкет...
              </div>
            ) : filteredPeople.length === 0 ? (
              <div className="rounded-3xl border bg-white p-8 text-center text-sm text-gray-400 space-y-3">
                <p>Никого не нашлось</p>
                <button
                  onClick={resetFilters}
                  className="inline-block rounded-2xl bg-pink-600 px-5 py-2 text-xs font-bold text-white transition hover:bg-pink-700 cursor-pointer"
                >
                  Сбросить фильтры ↺
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {filteredPeople.map((person) => {
                  const status = relations[person.id] || "none";
                  const online = isOnline(person.last_seen);
                  const isBusy = busyId === person.id;

                  return (
                    <div
                      key={person.id}
                      className="flex flex-col justify-between rounded-3xl border bg-white p-6 shadow-sm transition hover:shadow-md"
                    >
                      <div>
                        <div className="flex items-center gap-4 mb-4">
                          <div className="relative">
                            <img
                              src={getAvatar(person)}
                              alt={person.name}
                              className="h-16 w-16 rounded-full border object-cover"
                            />
                            {online && (
                              <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-white bg-green-500" />
                            )}
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">
                              {person.name}
                              {person.age ? ", " + person.age : ""}
                            </h3>
                            {person.city && (
                              <p className="text-xs text-gray-500">{person.city}</p>
                            )}
                          </div>
                        </div>

                        {person.bio && (
                          <p className="mb-4 text-sm text-gray-600">{person.bio}</p>
                        )}

                        {person.interests && person.interests.length > 0 && (
                          <div className="mb-4 flex flex-wrap gap-1.5">
                            {person.interests.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-lg bg-pink-50 px-2.5 py-1 text-[11px] font-medium text-pink-600"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {status === "matched" ? (
                        <button
                          onClick={() => handleOpenChat(person)}
                          className="w-full rounded-2xl bg-pink-600 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-700 active:scale-95"
                        >
                          Написать сообщение
                        </button>
                      ) : status === "liked" ? (
                        <button
                          disabled
                          className="w-full rounded-2xl bg-gray-100 py-2.5 text-sm font-semibold text-gray-400 cursor-default"
                        >
                          Лайк отправлен
                        </button>
                      ) : (
                        <button
                          onClick={() => handleLike(person)}
                          disabled={isBusy}
                          className="w-full rounded-2xl bg-pink-50 py-2.5 text-sm font-semibold text-pink-600 transition hover:bg-pink-100 active:scale-95 disabled:opacity-50"
                        >
                          {isBusy ? "..." : "Лайкнуть 💗"}
                        </button>
                      )}
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
