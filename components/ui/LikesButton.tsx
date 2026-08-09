"use client";

import Link from "next/link";

export default function LikesButton() {
  return (
    <Link
      href="/likes"
      className="bg-[#e6a3b8] p-6 rounded-3xl text-center text-white shadow-sm flex flex-col justify-center items-center w-full cursor-pointer hover:opacity-95 transition h-full"
    >
      <div className="text-2xl mb-1">💌</div>
      <h3 className="text-base font-bold text-white mb-0.5">Вам лайкнули</h3>
      <p className="text-xs text-white/90">Посмотрите, кто заинтересован</p>
    </Link>
  );
}
