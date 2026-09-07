"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  reporterName: string;
  reportedName: string;
  reportedAvatar?: string;
}

type FilterTab = "pending" | "actioned" | "dismissed" | "all";

export default function AdminReportsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState<FilterTab>("pending");
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

      const { data: myProfile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (!myProfile?.is_admin) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      setIsAdmin(true);

      const { data: reportsData, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Ошибка загрузки жалоб:", error);
        setIsLoading(false);
        return;
      }

      const userIds = Array.from(
        new Set(
          (reportsData || []).flatMap((r) => [r.reporter_id, r.reported_user_id])
        )
      );

      const { data: profilesData } = userIds.length
        ? await supabase.from("profiles").select("id, name, avatar_url, avatar").in("id", userIds)
        : { data: [] as any[] };

      const profilesMap = new Map((profilesData || []).map((p: any) => [p.id, p]));

      const enriched: Report[] = (reportsData || []).map((r) => ({
        ...r,
        reporterName: profilesMap.get(r.reporter_id)?.name || "Пользователь",
        reportedName: profilesMap.get(r.reported_user_id)?.name || "Пользователь",
        reportedAvatar:
          profilesMap.get(r.reported_user_id)?.avatar_url ||
          profilesMap.get(r.reported_user_id)?.avatar,
      }));

      setReports(enriched);
      setIsLoading(false);
    };

    load();
  }, []);

  const handleBan = async (report: Report) => {
    if (
      !confirm(
        "Забанить " +
          report.reportedName +
          "? Пользователь исчезнет из ленты, поиска, мэтчей и лайков у всех."
      )
    ) {
      return;
    }

    setBusyId(report.id);

    const { error: banError } = await supabase
      .from("profiles")
      .update({ is_banned: true })
      .eq("id", report.reported_user_id);

    if (banError) {
      console.error("Ошибка бана:", banError);
      alert("Не удалось забанить: " + banError.message);
      setBusyId(null);
      return;
    }

    const { error: statusError } = await supabase
      .from("reports")
      .update({ status: "actioned" })
      .eq("id", report.id);

    if (statusError) {
      console.error("Ошибка обновления статуса жалобы:", statusError);
    }

    setReports((prev) =>
      prev.map((r) => (r.id === report.id ? { ...r, status: "actioned" } : r))
    );

    setBusyId(null);
  };

  const handleDismiss = async (report: Report) => {
    setBusyId(report.id);

    const { error } = await supabase
      .from("reports")
      .update({ status: "dismissed" })
      .eq("id", report.id);

    setBusyId(null);

    if (error) {
      console.error("Ошибка отклонения жалобы:", error);
      alert("Не удалось отклонить: " + error.message);
      return;
    }

    setReports((prev) =>
      prev.map((r) => (r.id === report.id ? { ...r, status: "dismissed" } : r))
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center text-xs text-gray-400 animate-pulse">
        Загрузка...
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center gap-3 text-center px-6">
        <span className="text-4xl">🔒</span>
        <p className="text-sm font-bold text-gray-900">Доступ только для администраторов</p>
        <Link href="/" className="text-xs text-pink-600 font-bold hover:underline">
          ← На главную
        </Link>
      </div>
    );
  }

  const filteredReports =
    filter === "all" ? reports : reports.filter((r) => r.status === filter);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "pending", label: "В ожидании" },
    { key: "actioned", label: "Забанены" },
    { key: "dismissed", label: "Отклонены" },
    { key: "all", label: "Все" },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-800 pb-12">
      <header className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="text-xs font-bold text-gray-500 hover:text-gray-900 transition">
          ← На главную
        </Link>
        <span className="text-sm font-black tracking-wider text-gray-900">ЖАЛОБЫ (АДМИН)</span>
        <span className="w-16" />
      </header>

      <main className="max-w-4xl mx-auto px-6 pt-4 space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                filter === tab.key
                  ? "bg-black text-white"
                  : "bg-white text-gray-600 border border-gray-100 hover:bg-gray-50"
              }`}
            >
              {tab.label}
              {tab.key !== "all" && (
                <span className="ml-1 opacity-60">
                  ({reports.filter((r) => r.status === tab.key).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {filteredReports.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center text-xs text-gray-400 border border-gray-100">
            Жалоб в этой категории нет
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReports.map((report) => {
              const isBusy = busyId === report.id;

              return (
                <div
                  key={report.id}
                  className="bg-white rounded-3xl p-5 border border-gray-100 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-gray-600 font-bold text-xs uppercase shrink-0">
                        {report.reportedAvatar ? (
                          <img
                            src={report.reportedAvatar}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          report.reportedName.slice(0, 2)
                        )}
                      </div>

                      <div>
                        <p className="text-xs font-black text-gray-900">
                          На: {report.reportedName}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          От: {report.reporterName} ·{" "}
                          {new Date(report.created_at).toLocaleDateString("ru-RU", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${
                        report.status === "pending"
                          ? "bg-amber-100 text-amber-700"
                          : report.status === "actioned"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {report.status === "pending"
                        ? "Ожидает"
                        : report.status === "actioned"
                        ? "Забанен"
                        : "Отклонена"}
                    </span>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-3 space-y-1">
                    <p className="text-xs font-bold text-gray-800">{report.reason}</p>
                    {report.details && (
                      <p className="text-[11px] text-gray-600 whitespace-pre-wrap">
                        {report.details}
                      </p>
                    )}
                  </div>

                  {report.status === "pending" && (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleDismiss(report)}
                        disabled={isBusy}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold py-2.5 rounded-2xl transition cursor-pointer disabled:opacity-50"
                      >
                        Отклонить
                      </button>
                      <button
                        onClick={() => handleBan(report)}
                        disabled={isBusy}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-2.5 rounded-2xl transition cursor-pointer disabled:opacity-50"
                      >
                        {isBusy ? "..." : "Забанить пользователя"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
