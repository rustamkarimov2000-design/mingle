"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface VerificationItem {
  id: string;
  user_id: string;
  photo_path: string | null;
  created_at: string;
  name: string;
  age?: number | null;
  city?: string | null;
  profilePhotos: string[];
  selfieUrl: string | null;
}

export default function AdminVerificationsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [items, setItems] = useState<VerificationItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

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

      setMyId(user.id);

      const { data: me } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (!me?.is_admin) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      setIsAdmin(true);

      const { data: requests, error } = await supabase
        .from("verification_requests")
        .select("id, user_id, photo_path, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Ошибка загрузки заявок:", error);
        setIsLoading(false);
        return;
      }

      const rows = requests || [];
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));

      const [{ data: profiles }, { data: photos }] = userIds.length
        ? await Promise.all([
            supabase
              .from("profiles")
              .select("id, name, age, city, avatar_url, avatar")
              .in("id", userIds),
            supabase.from("photos").select("profile_id, url").in("profile_id", userIds),
          ])
        : [{ data: [] as any[] }, { data: [] as any[] }];

      const enriched: VerificationItem[] = await Promise.all(
        rows.map(async (r) => {
          const profile = (profiles || []).find((p: any) => p.id === r.user_id);
          const extra = (photos || [])
            .filter((p: any) => p.profile_id === r.user_id)
            .map((p: any) => p.url);

          const profilePhotos = Array.from(
            new Set([profile?.avatar_url || profile?.avatar, ...extra].filter(Boolean))
          ).slice(0, 4) as string[];

          let selfieUrl: string | null = null;
          if (r.photo_path) {
            const { data: signed } = await supabase.storage
              .from("verifications")
              .createSignedUrl(r.photo_path, 600);
            selfieUrl = signed?.signedUrl || null;
          }

          return {
            id: r.id,
            user_id: r.user_id,
            photo_path: r.photo_path,
            created_at: r.created_at,
            name: profile?.name || "Без имени",
            age: profile?.age,
            city: profile?.city,
            profilePhotos,
            selfieUrl,
          };
        })
      );

      setItems(enriched);
      setIsLoading(false);
    };

    load();
  }, []);

  const handleDecision = async (item: VerificationItem, approve: boolean) => {
    if (!myId) return;

    setBusyId(item.id);

    if (approve) {
      const { data, error } = await supabase
        .from("profiles")
        .update({ is_verified: true })
        .eq("id", item.user_id)
        .select("id");

      if (error || !data || data.length === 0) {
        alert(
          "Не удалось выдать значок: " +
            (error?.message || "нет прав (RLS) — проверьте, что выполнен step9_verification.sql")
        );
        setBusyId(null);
        return;
      }
    }

    const { error: statusError } = await supabase
      .from("verification_requests")
      .update({
        status: approve ? "approved" : "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: myId,
        photo_path: null,
      })
      .eq("id", item.id);

    if (statusError) {
      alert("Не удалось обновить заявку: " + statusError.message);
      setBusyId(null);
      return;
    }

    // Селфи после проверки удаляем — оно больше не нужно
    if (item.photo_path) {
      await supabase.storage.from("verifications").remove([item.photo_path]);
    }

    setItems((prev) => prev.filter((x) => x.id !== item.id));
    setBusyId(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center text-xs text-gray-400 animate-pulse">
        Загрузка...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 text-center border border-gray-100 max-w-sm w-full space-y-3">
          <p className="text-sm font-bold text-gray-800">Доступ только для администраторов</p>
          <Link href="/" className="text-xs font-bold text-pink-600">
            ← На главную
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-800 pb-12">
      <header className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <span className="text-sm font-black tracking-wider text-gray-900">✓ ПРОВЕРКА ФОТО</span>
        <Link href="/admin" className="text-xs font-bold text-gray-500 hover:text-gray-900">
          ← В админку
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-6 pt-2 space-y-4">
        {items.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 space-y-2">
            <span className="text-4xl block">🎉</span>
            <p className="text-sm font-bold text-gray-700">Новых заявок нет</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-3xl border border-gray-100 p-5 space-y-4"
            >
              <div>
                <p className="text-sm font-black text-gray-900">
                  {item.name}
                  {item.age ? ", " + item.age : ""}
                </p>
                <p className="text-[11px] text-gray-400">
                  {item.city ? item.city + " · " : ""}
                  заявка от{" "}
                  {new Date(item.created_at).toLocaleString("ru-RU", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    Селфи с жестом 👍
                  </p>
                  {item.selfieUrl ? (
                    <img
                      src={item.selfieUrl}
                      alt="Селфи"
                      className="w-full max-h-80 object-contain rounded-2xl bg-gray-50 border border-gray-100"
                    />
                  ) : (
                    <p className="text-xs text-rose-500">Не удалось загрузить фото</p>
                  )}
                </div>

                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    Фото из профиля
                  </p>
                  {item.profilePhotos.length === 0 ? (
                    <p className="text-xs text-gray-400">В профиле нет фото</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {item.profilePhotos.map((url) => (
                        <img
                          key={url}
                          src={url}
                          alt=""
                          className="w-full aspect-square object-cover rounded-2xl border border-gray-100"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDecision(item, true)}
                  disabled={busyId === item.id}
                  className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-2xl transition cursor-pointer"
                >
                  ✓ Одобрить
                </button>
                <button
                  onClick={() => handleDecision(item, false)}
                  disabled={busyId === item.id}
                  className="bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 text-xs font-bold px-5 py-2.5 rounded-2xl transition cursor-pointer"
                >
                  Отклонить
                </button>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
