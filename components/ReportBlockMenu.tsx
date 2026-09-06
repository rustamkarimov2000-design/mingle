"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const REPORT_REASONS = [
  "Спам или реклама",
  "Оскорбления / токсичное поведение",
  "Фейковый профиль",
  "Неприемлемый контент",
  "Мошенничество",
  "Другое",
];

interface ReportBlockMenuProps {
  targetUserId: string;
  targetName?: string;
  onBlocked?: () => void;
  className?: string;
}

export default function ReportBlockMenu({
  targetUserId,
  targetName,
  onBlocked,
  className,
}: ReportBlockMenuProps) {
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);

  const handleBlock = async () => {
    if (
      !confirm(
        "Заблокировать " +
          (targetName || "этого пользователя") +
          "? Вы перестанете видеть друг друга в приложении."
      )
    ) {
      return;
    }

    setIsBlocking(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIsBlocking(false);
      return;
    }

    const { error } = await supabase.from("blocks").insert({
      blocker_id: user.id,
      blocked_id: targetUserId,
    });

    setIsBlocking(false);
    setOpen(false);

    if (error) {
      console.error("Ошибка блокировки:", error);
      alert("Не удалось заблокировать: " + error.message);
      return;
    }

    onBlocked?.();
  };

  const handleSubmitReport = async () => {
    if (!selectedReason) return;

    setIsSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      reported_user_id: targetUserId,
      reason: selectedReason,
      details: details.trim() || null,
    });

    setIsSubmitting(false);

    if (error) {
      console.error("Ошибка отправки жалобы:", error);
      alert("Не удалось отправить жалобу: " + error.message);
      return;
    }

    setShowReportModal(false);
    setSelectedReason("");
    setDetails("");
    alert("Жалоба отправлена. Спасибо, мы её рассмотрим.");
  };

  return (
    <div className={"relative " + (className || "")}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        title="Ещё"
        className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition cursor-pointer text-lg leading-none"
      >
        ⋯
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />

          <div className="absolute right-0 top-8 z-20 bg-white rounded-2xl shadow-lg border border-gray-100 py-1 w-48 text-xs">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                setShowReportModal(true);
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-gray-700 font-medium cursor-pointer"
            >
              🚩 Пожаловаться
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleBlock();
              }}
              disabled={isBlocking}
              className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-red-600 font-medium cursor-pointer disabled:opacity-50"
            >
              🚫 {isBlocking ? "Блокируем..." : "Заблокировать"}
            </button>
          </div>
        </>
      )}

      {showReportModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={(e) => {
            e.stopPropagation();
            setShowReportModal(false);
          }}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-sm p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-900">
                Пожаловаться{targetName ? " на " + targetName : ""}
              </h3>

              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="text-gray-400 hover:text-gray-700 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              {REPORT_REASONS.map((reason) => (
                <button
                  type="button"
                  key={reason}
                  onClick={() => setSelectedReason(reason)}
                  className={
                    "w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer border " +
                    (selectedReason === reason
                      ? "bg-pink-50 border-pink-300 text-pink-600"
                      : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100")
                  }
                >
                  {reason}
                </button>
              ))}
            </div>

            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Дополнительные детали (необязательно)"
              rows={3}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2 text-xs focus:outline-none focus:border-pink-300 resize-none"
            />

            <button
              type="button"
              onClick={handleSubmitReport}
              disabled={!selectedReason || isSubmitting}
              className="w-full bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white text-xs font-bold py-3 rounded-2xl transition cursor-pointer"
            >
              {isSubmitting ? "Отправка..." : "Отправить жалобу"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
