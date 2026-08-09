"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { label: "Главная", href: "/", icon: "🏠" },
    { label: "Мэтчи", href: "/matches", icon: "🔥" },
    { label: "Лайки", href: "/likes", icon: "💌" },
    { label: "Люди", href: "/people", icon: "👥" },
    { label: "Сообщения", href: "/messages", icon: "💬" },
    { label: "Мой профиль", href: "/profile", icon: "👤" },
  ];

  return (
    <aside className="rounded-3xl border bg-white p-4 shadow-sm space-y-2">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 font-semibold text-sm transition ${
              isActive
                ? "bg-pink-50 text-pink-600"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </aside>
  );
}
