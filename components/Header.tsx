"use client";

import Link from "next/link";

interface HeaderProps {
  user?: { name: string; avatar: string } | null;
  onLogout?: () => void;
}

export default function Header({
  user = null,
  onLogout = () => {},
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-4">
        <Link
          href="/"
          className="text-xl font-bold tracking-wide text-black hover:opacity-80 transition cursor-pointer select-none"
        >
          MINGLE
        </Link>

        <div>
          {user ? (
            <div className="flex items-center gap-3">
              <Link href="/profile" className="flex items-center gap-3">
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="h-10 w-10 rounded-full border-2 border-pink-500 object-cover shadow-sm"
                />
                <span className="font-semibold text-gray-800 hidden sm:inline">
                  {user.name}
                </span>
              </Link>
              <button
                onClick={onLogout}
                className="ml-2 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition"
              >
                Выйти
              </button>
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="rounded-2xl bg-pink-600 px-5 py-2.5 font-semibold text-white shadow-md shadow-pink-600/20 transition hover:bg-pink-700 active:scale-95"
            >
              Войти
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}