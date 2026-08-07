"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";

interface Person {
  id: number;
  name: string;
  age: number;
  city: string;
  avatar: string;
  bio: string;
  interests: string[];
  online: boolean;
}

const initialPeople: Person[] = [
  {
    id: 1,
    name: "Екатерина Иванова",
    age: 24,
    city: "Москва",
    avatar: "https://ui-avatars.com/api/?name=Екатерина+Иванова&background=f472b6&color=fff",
    bio: "Люблю путешествия, кофе и веб-дизайн ✨",
    interests: ["Путешествия", "Дизайн", "Кофе"],
    online: true,
  },
  {
    id: 2,
    name: "Дмитрий Петров",
    age: 28,
    city: "Санкт-Петербург",
    avatar: "https://ui-avatars.com/api/?name=Дмитрий+Петров&background=60a5fa&color=fff",
    bio: "Frontend developer, бегаю марафоны 🏃‍♂️",
    interests: ["Кодинг", "Бег", "Музыка"],
    online: false,
  },
  {
    id: 3,
    name: "Ольга Сидорова",
    age: 22,
    city: "Казань",
    avatar: "https://ui-avatars.com/api/?name=Ольга+Сидорова&background=34d399&color=fff",
    bio: "Фотограф, ищу единомышленников для творческих проектов 📸",
    interests: ["Фотография", "Искусство", "Кино"],
    online: true,
  },
  {
    id: 4,
    name: "Алексей Смирнов",
    age: 26,
    city: "Новосибирск",
    avatar: "https://ui-avatars.com/api/?name=Алексей+Смирнов&background=fbbf24&color=fff",
    bio: "Люблю настолки и походы 🏕",
    interests: ["Настолки", "Походы", "IT"],
    online: true,
  },
];

export default function PeoplePage() {
  const router = useRouter();
  const [people] = useState<Person[]>(initialPeople);
  const [search, setSearch] = useState("");

  const filteredPeople = people.filter(
    (person) =>
      person.name.toLowerCase().includes(search.toLowerCase()) ||
      person.city.toLowerCase().includes(search.toLowerCase())
  );

  // Переход в чат с передачей ID пользователя через query-параметр
  const handleOpenChat = (person: Person) => {
    // Сохраняем информацию о пользователе, чтобы в /messages её можно было подтянуть
    const pendingChat = {
      id: person.id,
      name: person.name,
      avatar: person.avatar,
      online: person.online,
    };
    localStorage.setItem("mingle_pending_chat", JSON.stringify(pendingChat));
    router.push(`/messages?userId=${person.id}`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6">
        <div className="grid flex-1 grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <aside className="hidden lg:sticky lg:top-20 lg:block lg:col-span-3">
            <Sidebar />
          </aside>

          <section className="col-span-1 space-y-6 lg:col-span-9">
            {/* Поиск */}
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

            {/* Сетка пользователей */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {filteredPeople.map((person) => (
                <div
                  key={person.id}
                  className="flex flex-col justify-between rounded-3xl border bg-white p-6 shadow-sm transition hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="relative">
                        <img
                          src={person.avatar}
                          alt={person.name}
                          className="h-16 w-16 rounded-full border object-cover"
                        />
                        {person.online && (
                          <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-white bg-green-500" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">
                          {person.name}, {person.age}
                        </h3>
                        <p className="text-xs text-gray-500">{person.city}</p>
                      </div>
                    </div>

                    <p className="mb-4 text-sm text-gray-600">{person.bio}</p>

                    <div className="mb-6 flex flex-wrap gap-1.5">
                      {person.interests.map((interest, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-pink-50 px-3 py-1 text-xs font-medium text-pink-600"
                        >
                          #{interest}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenChat(person)}
                    className="w-full rounded-2xl bg-pink-600 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-700 active:scale-95"
                  >
                    Написать сообщение
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}