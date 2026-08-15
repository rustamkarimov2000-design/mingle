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
  bio?: string;
  avatar_url?: string;
  avatar?: string;
  last_seen?: string;
}

type RelationStatus = "none" | "liked" | "matched";

export default function PeoplePage() {
  const router = useRouter();
  const supabase = createClient();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [relations, setRelations] = useState<Record<string, RelationStatus>>({});
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

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

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, age, city, bio, avatar_url, avatar, last_seen")
        .neq("id", user.id);

      if (profilesError) {
        console.error("Ошибка загрузки людей:", profilesError);
        setIsLoading(false);
        return;
      }

      setPeople(profilesData || []);

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
      (profilesData || []).forEach((p) => {
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

  const filteredPeople = people.filter(
    (person) =>
      (person.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (person.city || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6">
        <div className="grid flex-1 grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <aside className="hidden lg:sticky lg:top-20 lg:block lg:col-span-3">
            <Sidebar />
          </aside>

          <section className="col-span-1 space-y-6 lg:col-span-9">
            <div className="rounded-3xl border bg-white p-6 shadow-sm">
              <h1 className="mb-4 text-2xl font-bold text-gray-900">
                Знакомства в Mingle
              </h1>
              <input
                type="text"
                placeholder="Поиск по имени или городу..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-2xl border bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-pink-500 focus:bg-white"
              />
            </div>

            {isLoading ? (
              <div className="rounded-3xl border bg-white p-8 text-center text-sm text-gray-400">
                Загрузка анкет...
              </div>
            ) : filteredPeople.length === 0 ? (
              <div className="rounded-3xl border bg-white p-8 text-center text-sm text-gray-400">
                Никого не нашлось
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
                          <p className="mb-6 text-sm text-gray-600">{person.bio}</p>
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
