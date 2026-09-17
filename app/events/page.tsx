"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fetchBlockedUserIds } from "@/lib/blocking";

interface Attendee {
  user_id: string;
  name: string;
  avatar?: string;
}

interface EventItem {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  category: string | null;
  city: string;
  location: string | null;
  event_date: string;
  image_url: string | null;
  creatorName: string;
  attendees: Attendee[];
}

const CATEGORIES: { value: string; label: string; emoji: string }[] = [
  { value: "party", label: "Вечеринка", emoji: "🎉" },
  { value: "sport", label: "Спорт", emoji: "⚽" },
  { value: "board_games", label: "Настолки", emoji: "🎲" },
  { value: "walk", label: "Прогулка", emoji: "🚶" },
  { value: "cafe", label: "Кафе / бар", emoji: "☕" },
  { value: "concert", label: "Концерт", emoji: "🎵" },
  { value: "other", label: "Другое", emoji: "✨" },
];

function categoryEmoji(value: string | null) {
  return CATEGORIES.find((c) => c.value === value)?.emoji || "✨";
}

function categoryLabel(value: string | null) {
  return CATEGORIES.find((c) => c.value === value)?.label || "Другое";
}

function formatEventDate(dateStr: string) {
  const d = new Date(dateStr);
  return (
    d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) +
    " · " +
    d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
  );
}

export default function EventsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cityFilter, setCityFilter] = useState("Все");
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [detailEventId, setDetailEventId] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "party",
    city: "",
    location: "",
    date: "",
    time: "",
  });

  const loadEvents = async () => {
    setIsLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth/login");
      return;
    }

    setUserId(user.id);

    const blockedIds = await fetchBlockedUserIds(supabase, user.id);

    const { data: eventsData, error } = await supabase
      .from("events")
      .select("*")
      .gte("event_date", new Date().toISOString())
      .order("event_date", { ascending: true });

    if (error) {
      console.error("Ошибка загрузки событий:", error);
      setIsLoading(false);
      return;
    }

    const visibleEvents = (eventsData || []).filter(
      (e) => !blockedIds.has(e.creator_id)
    );

    if (visibleEvents.length === 0) {
      setEvents([]);
      setIsLoading(false);
      return;
    }

    const eventIds = visibleEvents.map((e) => e.id);
    const creatorIds = Array.from(new Set(visibleEvents.map((e) => e.creator_id)));

    const [attendeesRes, creatorsRes] = await Promise.all([
      supabase.from("event_attendees").select("event_id, user_id").in("event_id", eventIds),
      supabase.from("profiles").select("id, name").in("id", creatorIds),
    ]);

    const attendeesData = attendeesRes.data || [];
    const creatorsMap = new Map((creatorsRes.data || []).map((p: any) => [p.id, p.name]));

    const attendeeUserIds = Array.from(
      new Set(attendeesData.map((a) => a.user_id).filter((id) => !blockedIds.has(id)))
    );

    const { data: attendeeProfiles } = attendeeUserIds.length
      ? await supabase.from("profiles").select("id, name, avatar_url, avatar").in("id", attendeeUserIds)
      : { data: [] as any[] };

    const attendeeProfileMap = new Map((attendeeProfiles || []).map((p: any) => [p.id, p]));

    const enriched: EventItem[] = visibleEvents.map((e) => {
      const eventAttendees = attendeesData
        .filter((a) => a.event_id === e.id && !blockedIds.has(a.user_id))
        .map((a) => {
          const p = attendeeProfileMap.get(a.user_id);
          return {
            user_id: a.user_id,
            name: p?.name || "Пользователь",
            avatar: p?.avatar_url || p?.avatar,
          };
        });

      return {
        ...e,
        creatorName: creatorsMap.get(e.creator_id) || "Пользователь",
        attendees: eventAttendees,
      };
    });

    setEvents(enriched);
    setIsLoading(false);
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const cityOptions = [
    "Все",
    ...Array.from(new Set(events.map((e) => e.city).filter(Boolean))),
  ];

  const filteredEvents =
    cityFilter === "Все" ? events : events.filter((e) => e.city === cityFilter);

  const handleJoinToggle = async (event: EventItem) => {
    if (!userId) return;

    const isJoined = event.attendees.some((a) => a.user_id === userId);
    setBusyEventId(event.id);

    if (isJoined) {
      const { error } = await supabase
        .from("event_attendees")
        .delete()
        .eq("event_id", event.id)
        .eq("user_id", userId);

      if (error) {
        console.error("Ошибка выхода из события:", error);
        alert("Не удалось отменить участие: " + error.message);
        setBusyEventId(null);
        return;
      }

      setEvents((prev) =>
        prev.map((e) =>
          e.id === event.id
            ? { ...e, attendees: e.attendees.filter((a) => a.user_id !== userId) }
            : e
        )
      );
    } else {
      const { error } = await supabase.from("event_attendees").insert({
        event_id: event.id,
        user_id: userId,
      });

      if (error) {
        console.error("Ошибка присоединения к событию:", error);
        alert("Не удалось присоединиться: " + error.message);
        setBusyEventId(null);
        return;
      }

      const { data: myProfile } = await supabase
        .from("profiles")
        .select("name, avatar_url, avatar")
        .eq("id", userId)
        .single();

      setEvents((prev) =>
        prev.map((e) =>
          e.id === event.id
            ? {
                ...e,
                attendees: [
                  ...e.attendees,
                  {
                    user_id: userId,
                    name: myProfile?.name || "Пользователь",
                    avatar: myProfile?.avatar_url || myProfile?.avatar,
                  },
                ],
              }
            : e
        )
      );
    }

    setBusyEventId(null);
  };

  const handleCreateEvent = async () => {
    if (!userId || !form.title.trim() || !form.city.trim() || !form.date || !form.time) {
      alert("Заполните название, город, дату и время");
      return;
    }

    setIsCreating(true);

    const eventDateTime = new Date(form.date + "T" + form.time + ":00").toISOString();

    const { data, error } = await supabase
      .from("events")
      .insert({
        creator_id: userId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category,
        city: form.city.trim(),
        location: form.location.trim() || null,
        event_date: eventDateTime,
      })
      .select()
      .single();

    if (error) {
      console.error("Ошибка создания события:", error);
      alert("Не удалось создать событие: " + error.message);
      setIsCreating(false);
      return;
    }

    // Создатель автоматически участвует в своём событии
    await supabase.from("event_attendees").insert({
      event_id: data.id,
      user_id: userId,
    });

    setIsCreating(false);
    setShowCreateModal(false);
    setForm({
      title: "",
      description: "",
      category: "party",
      city: "",
      location: "",
      date: "",
      time: "",
    });

    await loadEvents();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center text-xs text-gray-400 animate-pulse">
        Загрузка событий...
      </div>
    );
  }

  const detailEvent = detailEventId ? events.find((e) => e.id === detailEventId) : null;

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-800 pb-12">
      <header className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <span className="text-sm font-black tracking-wider text-gray-900">
          🎉 СОБЫТИЯ РЯДОМ
        </span>

        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-[#E02868] hover:bg-pink-700 text-white text-xs font-bold px-4 py-2 rounded-full transition cursor-pointer"
        >
          + Создать
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 pt-2 space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {cityOptions.map((city) => (
            <button
              key={city}
              onClick={() => setCityFilter(city)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                cityFilter === city
                  ? "bg-black text-white"
                  : "bg-white text-gray-600 border border-gray-100 hover:bg-gray-50"
              }`}
            >
              📍 {city}
            </button>
          ))}
        </div>

        {filteredEvents.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center space-y-2 border border-gray-100">
            <span className="text-4xl block">🗓️</span>
            <p className="text-sm font-bold text-gray-700">Пока нет предстоящих событий</p>
            <p className="text-xs text-gray-400">Будьте первым, кто организует встречу!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredEvents.map((event) => {
              const isJoined = userId
                ? event.attendees.some((a) => a.user_id === userId)
                : false;
              const isBusy = busyEventId === event.id;
              const isOwn = event.creator_id === userId;

              return (
                <div
                  key={event.id}
                  className="bg-white rounded-3xl p-5 border border-gray-100 shadow-xs space-y-3 cursor-pointer hover:shadow-md transition"
                  onClick={() => setDetailEventId(event.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{categoryEmoji(event.category)}</span>
                      <div>
                        <h3 className="text-sm font-black text-gray-900 leading-tight">
                          {event.title}
                        </h3>
                        <p className="text-[10px] text-gray-400">
                          {categoryLabel(event.category)}
                        </p>
                      </div>
                    </div>

                    {isOwn && (
                      <span className="bg-pink-50 text-pink-600 text-[9px] font-bold px-2 py-1 rounded-full shrink-0">
                        Ваше
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-gray-600 space-y-1">
                    <p>🕒 {formatEventDate(event.event_date)}</p>
                    <p>
                      📍 {event.city}
                      {event.location ? " · " + event.location : ""}
                    </p>
                    <p>👤 Организатор: {event.creatorName}</p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                    <div className="flex items-center -space-x-2">
                      {event.attendees.slice(0, 4).map((a) => (
                        <div
                          key={a.user_id}
                          className="w-7 h-7 rounded-full border-2 border-white bg-gray-200 overflow-hidden flex items-center justify-center text-[9px] font-bold text-gray-600 uppercase"
                          title={a.name}
                        >
                          {a.avatar ? (
                            <img src={a.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            a.name.slice(0, 2)
                          )}
                        </div>
                      ))}
                      <span className="text-[10px] text-gray-400 pl-3">
                        {event.attendees.length} участник(ов)
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJoinToggle(event);
                      }}
                      disabled={isBusy}
                      className={`text-[11px] font-bold px-3 py-1.5 rounded-xl transition cursor-pointer disabled:opacity-50 ${
                        isJoined
                          ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          : "bg-pink-500 hover:bg-pink-600 text-white"
                      }`}
                    >
                      {isBusy ? "..." : isJoined ? "Не пойду" : "Присоединиться"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ДЕТАЛИ СОБЫТИЯ */}
      {detailEvent && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setDetailEventId(null)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{categoryEmoji(detailEvent.category)}</span>
                <div>
                  <h3 className="text-sm font-black text-gray-900">{detailEvent.title}</h3>
                  <p className="text-[10px] text-gray-400">
                    {categoryLabel(detailEvent.category)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setDetailEventId(null)}
                className="text-gray-400 hover:text-gray-700 text-lg font-bold cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="text-xs text-gray-600 space-y-1.5">
                <p>🕒 {formatEventDate(detailEvent.event_date)}</p>
                <p>
                  📍 {detailEvent.city}
                  {detailEvent.location ? " · " + detailEvent.location : ""}
                </p>
                <p>👤 Организатор: {detailEvent.creatorName}</p>
              </div>

              {detailEvent.description && (
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    Описание
                  </h4>
                  <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {detailEvent.description}
                  </p>
                </div>
              )}

              <div>
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Участники ({detailEvent.attendees.length})
                </h4>
                <div className="space-y-1.5">
                  {detailEvent.attendees.length === 0 ? (
                    <p className="text-[11px] text-gray-400 italic">Пока никто не записался</p>
                  ) : (
                    detailEvent.attendees.map((a) => (
                      <div key={a.user_id} className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-[9px] font-bold text-gray-600 uppercase">
                          {a.avatar ? (
                            <img src={a.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            a.name.slice(0, 2)
                          )}
                        </div>
                        <span className="text-xs font-medium text-gray-800">{a.name}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100">
              <button
                onClick={() => handleJoinToggle(detailEvent)}
                disabled={busyEventId === detailEvent.id}
                className={`w-full text-xs font-bold py-3 rounded-2xl transition cursor-pointer disabled:opacity-50 ${
                  detailEvent.attendees.some((a) => a.user_id === userId)
                    ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    : "bg-[#E02868] hover:bg-pink-700 text-white"
                }`}
              >
                {detailEvent.attendees.some((a) => a.user_id === userId)
                  ? "Отменить участие"
                  : "Присоединиться"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* СОЗДАНИЕ СОБЫТИЯ */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-900">Новое событие</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-700 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Название</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Например, Настолки в кафе"
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-xs focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Категория</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setForm({ ...form, category: cat.value })}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        form.category === cat.value
                          ? "bg-black text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {cat.emoji} {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Город</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="Челябинск"
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-xs focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Место</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="Кафе «Central»"
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-xs focus:outline-none focus:border-pink-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Дата</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-xs focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Время</label>
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-xs focus:outline-none focus:border-pink-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">
                  Описание (необязательно)
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Расскажите подробнее, что будет на встрече..."
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-xs focus:outline-none focus:border-pink-500 resize-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-100">
              <button
                onClick={handleCreateEvent}
                disabled={isCreating}
                className="w-full bg-[#E02868] hover:bg-pink-700 disabled:opacity-50 text-white text-xs font-bold py-3 rounded-2xl transition cursor-pointer"
              >
                {isCreating ? "Создание..." : "Создать событие"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
