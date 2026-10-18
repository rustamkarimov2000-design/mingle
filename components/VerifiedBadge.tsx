interface VerifiedBadgeProps {
  className?: string;
}

// Небольшой синий значок ✓ рядом с именем проверенного пользователя
export default function VerifiedBadge({ className }: VerifiedBadgeProps) {
  return (
    <span
      title="Профиль подтверждён"
      aria-label="Профиль подтверждён"
      className={
        "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sky-500 text-[10px] font-black leading-none text-white align-middle " +
        (className || "")
      }
    >
      ✓
    </span>
  );
}
