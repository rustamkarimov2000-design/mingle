"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compressImage";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import VerifiedBadge from "@/components/VerifiedBadge";

type RequestStatus = "pending" | "approved" | "rejected";

export default function VerifyPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [lastStatus, setLastStatus] = useState<RequestStatus | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth/login");
      return;
    }

    setUserId(user.id);

    const [{ data: profile }, { data: requests }] = await Promise.all([
      supabase.from("profiles").select("is_verified").eq("id", user.id).single(),
      supabase
        .from("verification_requests")
        .select("status, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    setIsVerified(!!profile?.is_verified);
    setLastStatus((requests?.[0]?.status as RequestStatus) || null);
    setIsLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.type.startsWith("image/")) {
      setError("Выберите фото (JPG или PNG).");
      return;
    }

    setError(null);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const handleSubmit = async () => {
    if (!file || !userId) return;

    setIsSending(true);
    setError(null);

    try {
      const compressed = await compressImage(file, { maxSize: 1200 });
      const ext = compressed.name.split(".").pop() || "jpg";
      const path = userId + "/" + Date.now() + "." + ext;

      const { error: uploadError } = await supabase.storage
        .from("verifications")
        .upload(path, compressed);

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("verification_requests")
        .insert({ user_id: userId, photo_path: path, status: "pending" });

      if (insertError) {
        // не оставляем лишний файл, если заявку не удалось создать
        await supabase.storage.from("verifications").remove([path]);
        throw insertError;
      }

      setFile(null);
      setPreview(null);
      await load();
    } catch (err: any) {
      console.error("Ошибка отправки заявки на проверку:", err);
      setError(
        "Не удалось отправить: " +
          (err?.message || "неизвестная ошибка") +
          (String(err?.message || "").includes("duplicate")
            ? " (заявка уже на рассмотрении)"
            : "")
      );
    }

    setIsSending(false);
  };

  const canSend = !isVerified && lastStatus !== "pending";

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6">
        <div className="grid flex-1 grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <aside className="hidden lg:sticky lg:top-20 lg:block lg:col-span-3">
            <Sidebar />
          </aside>

          <section className="col-span-1 space-y-4 lg:col-span-9">
            <div className="flex items-center gap-3">
              <Link
                href="/profile"
                className="text-xs font-bold text-gray-500 hover:text-gray-900 transition"
              >
                ← В профиль
              </Link>
              <h1 className="text-sm font-black tracking-wider">Подтверждение профиля</h1>
            </div>

            {isLoading ? (
              <div className="bg-white rounded-3xl p-8 text-center text-xs text-gray-400 border border-gray-100 animate-pulse">
                Загрузка...
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-5 max-w-xl">
                {isVerified ? (
                  <div className="text-center space-y-2 py-4">
                    <div className="text-4xl">✅</div>
                    <p className="text-sm font-black text-gray-900 flex items-center justify-center gap-2">
                      Ваш профиль подтверждён <VerifiedBadge />
                    </p>
                    <p className="text-xs text-gray-500">
                      Значок виден всем рядом с вашим именем.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <p className="text-sm font-black text-gray-900">
                        Получите значок <VerifiedBadge /> рядом с именем
                      </p>
                      <p className="text-xs text-gray-500">
                        Проверенным профилям доверяют больше. Это занимает минуту.
                      </p>
                    </div>

                    {lastStatus === "pending" && (
                      <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs p-3 rounded-xl">
                        ⏳ Ваша заявка на рассмотрении. Мы пришлём уведомление, когда проверим фото.
                      </div>
                    )}

                    {lastStatus === "rejected" && (
                      <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs p-3 rounded-xl">
                        Прошлое фото не подошло. Попробуйте ещё раз по правилам ниже.
                      </div>
                    )}

                    {canSend && (
                      <>
                        <ol className="text-xs text-gray-600 space-y-1.5 list-decimal pl-4">
                          <li>Сделайте селфи при хорошем свете, лицо хорошо видно.</li>
                          <li>Покажите жест 👍 (большой палец вверх) рядом с лицом.</li>
                          <li>Без очков, масок и фильтров. Это должен быть тот же человек, что на фото в профиле.</li>
                        </ol>

                        <p className="text-[11px] text-gray-400">
                          🔒 Селфи видят только администраторы и только для проверки. Сразу после проверки фото удаляется.
                        </p>

                        {preview && (
                          <img
                            src={preview}
                            alt="Ваше селфи"
                            className="w-48 h-48 rounded-2xl object-cover border border-gray-100"
                          />
                        )}

                        {error && (
                          <p className="text-xs text-rose-600">{error}</p>
                        )}

                        <div className="flex items-center gap-3">
                          <label className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-4 py-2.5 rounded-2xl transition cursor-pointer">
                            {preview ? "Выбрать другое" : "Выбрать фото"}
                            <input
                              type="file"
                              accept="image/*"
                              capture="user"
                              className="hidden"
                              onChange={handleSelect}
                            />
                          </label>

                          <button
                            onClick={handleSubmit}
                            disabled={!file || isSending}
                            className="bg-[#E02868] hover:bg-pink-700 disabled:opacity-40 text-white text-xs font-bold px-5 py-2.5 rounded-2xl transition cursor-pointer"
                          >
                            {isSending ? "Отправка..." : "Отправить на проверку"}
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
