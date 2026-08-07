"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, useMotionValue, useTransform, useAnimation, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";

interface Candidate {
  id: number;
  name: string;
  age: number;
  city: string;
  avatar: string;
  photos: string[];
  bio: string;
  interests: string[];
  isMatch: boolean;
}

const candidatesList: Candidate[] = [
  {
    id: 101,
    name: "Алёна",
    age: 23,
    city: "Москва",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80",
    photos: [
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80",
    ],
    bio: "Обожаю кофе ☕, фотографию и утренние пробежки по парку.",
    interests: ["Фотография", "Кофе", "Бег", "Искусство"],
    isMatch: true,
  },
  {
    id: 102,
    name: "София",
    age: 25,
    city: "Санкт-Петербург",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80",
    photos: [
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80",
    ],
    bio: "Архитектор. Ищу человека для поездок на выходные и ужинов при свечах.",
    interests: ["Архитектура", "Путешествия", "Вино", "Музеи"],
    isMatch: true,
  },
  {
    id: 103,
    name: "Максим",
    age: 27,
    city: "Казань",
    avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=600&q=80",
    photos: [
      "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80",
    ],
    bio: "Пишу код по будням, катаю на сноуборде по выходным 🏂",
    interests: ["Сноуборд", "IT", "Стартапы", "Рок"],
    isMatch: false,
  },
  {
    id: 104,
    name: "Виктория",
    age: 22,
    city: "Москва",
    avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80",
    photos: [
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80",
    ],
    bio: "Мечтаю открыть свою кофейню. Научу тебя разбираться в матче! 🍵",
    interests: ["Кулинария", "Книги", "Дизайн"],
    isMatch: true,
  },
];

export default function MatchesPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0); // 👈 Текущий индекс фотографии в карточке
  const [matches, setMatches] = useState<Candidate[]>([]);
  const [showMatchModal, setShowMatchModal] = useState<Candidate | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Framer Motion
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-18, 18]);
  const likeOpacity = useTransform(x, [20, 120], [0, 1]);
  const dislikeOpacity = useTransform(x, [-20, -120], [0, 1]);
  const controls = useAnimation();

  useEffect(() => {
    const savedMatches = localStorage.getItem("mingle_matches");
    if (savedMatches) {
      try {
        setMatches(JSON.parse(savedMatches));
      } catch (e) {
        console.error(e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Сброс индекса фото при смене анкеты
  useEffect(() => {
    setPhotoIndex(0);
  }, [currentIndex]);

  const triggerConfetti = () => {
    const count = 200;
    const defaults = { origin: { y: 0.7 }, zIndex: 9999 };

    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, { spread: 26, startVelocity: 55, colors: ["#ec4899", "#f43f5e", "#a855f7"] });
    fire(0.2, { spread: 60, colors: ["#ffffff", "#f472b6", "#fb7185"] });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, colors: ["#ec4899", "#38bdf8", "#facc15"] });
    fire(0.1, { spread: 120, startVelocity: 45 });
  };

  const saveMatches = (newMatches: Candidate[]) => {
    setMatches(newMatches);
    localStorage.setItem("mingle_matches", JSON.stringify(newMatches));
  };

  const handleGoToChat = (candidate: Candidate) => {
    const pendingChat = {
      id: candidate.id,
      name: candidate.name,
      avatar: candidate.avatar,
      online: true,
    };
    localStorage.setItem("mingle_pending_chat", JSON.stringify(pendingChat));
    setShowMatchModal(null);
  };

  const processChoice = (isLike: boolean) => {
    const current = candidatesList[currentIndex];
    if (!current) return;

    if (isLike) {
      if (current.isMatch) {
        const updated = [current, ...matches.filter((m) => m.id !== current.id)];
        saveMatches(updated);
        setShowMatchModal(current);
        triggerConfetti();
      } else {
        setCurrentIndex((prev) => prev + 1);
      }
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
    x.set(0);
  };

  const handleDragEnd = (_: any, info: any) => {
    const threshold = 100;
    if (info.offset.x > threshold) {
      controls.start({ x: 500, opacity: 0 }).then(() => processChoice(true));
    } else if (info.offset.x < -threshold) {
      controls.start({ x: -500, opacity: 0 }).then(() => processChoice(false));
    } else {
      controls.start({ x: 0, opacity: 1 });
    }
  };

  const triggerSwipe = (direction: "left" | "right") => {
    const targetX = direction === "right" ? 500 : -500;
    controls.start({ x: targetX, opacity: 0 }).then(() => {
      processChoice(direction === "right");
      controls.set({ x: 0, opacity: 1 });
    });
  };

  // Переключение фотографий
  const handlePrevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation(); // Чтобы свайп не срабатывал при клике
    if (photoIndex > 0) {
      setPhotoIndex((prev) => prev - 1);
    }
  };

  const handleNextPhoto = (e: React.MouseEvent, maxPhotos: number) => {
    e.stopPropagation();
    if (photoIndex < maxPhotos - 1) {
      setPhotoIndex((prev) => prev + 1);
    }
  };

  const currentCandidate = candidatesList[currentIndex];
  const nextCandidate = candidatesList[currentIndex + 1];

  if (!isLoaded) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6">
        <div className="grid flex-1 grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Левое меню */}
          <aside className="hidden lg:sticky lg:top-20 lg:block lg:col-span-3">
            <Sidebar />
          </aside>

          {/* Карточки */}
          <section className="col-span-1 lg:col-span-6 flex flex-col items-center">
            <div className="w-full max-w-md">
              <h1 className="text-2xl font-black text-gray-900 mb-4 text-center">
                Мэтчи Mingle ✨
              </h1>

              {currentCandidate ? (
                <div className="relative h-[540px] w-full">
                  {/* Фоновая следующая карточка */}
                  {nextCandidate && (
                    <div className="absolute inset-0 rounded-3xl border bg-white shadow-md scale-95 translate-y-3 opacity-60 pointer-events-none overflow-hidden">
                      <div className="relative h-80 w-full">
                        <img
                          src={nextCandidate.photos[0]}
                          alt={nextCandidate.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="p-5">
                        <h2 className="text-2xl font-bold">{nextCandidate.name}, {nextCandidate.age}</h2>
                        <p className="text-xs text-gray-500 mt-1">{nextCandidate.bio}</p>
                      </div>
                    </div>
                  )}

                  {/* Главная свайпаемая карточка */}
                  <motion.div
                    key={currentCandidate.id}
                    style={{ x, rotate }}
                    animate={controls}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    onDragEnd={handleDragEnd}
                    whileTap={{ cursor: "grabbing" }}
                    className="absolute inset-0 cursor-grab touch-none rounded-3xl border bg-white shadow-2xl overflow-hidden select-none"
                  >
                    {/* Бейджи LIKE / NOPE */}
                    <motion.div
                      style={{ opacity: likeOpacity }}
                      className="absolute top-8 left-6 z-30 rounded-xl border-4 border-emerald-500 bg-emerald-500/10 px-4 py-1.5 text-2xl font-black uppercase text-emerald-500 rotate-[-15deg] pointer-events-none"
                    >
                      LIKE 💕
                    </motion.div>

                    <motion.div
                      style={{ opacity: dislikeOpacity }}
                      className="absolute top-8 right-6 z-30 rounded-xl border-4 border-red-500 bg-red-500/10 px-4 py-1.5 text-2xl font-black uppercase text-red-500 rotate-[15deg] pointer-events-none"
                    >
                      NOPE ❌
                    </motion.div>

                    {/* Блок фотографии с галлереей */}
                    <div className="relative h-80 w-full bg-black">
                      <img
                        src={currentCandidate.photos[photoIndex]}
                        alt={currentCandidate.name}
                        className="h-full w-full object-cover pointer-events-none transition-all duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />

                      {/* Индикаторы полосок Сториз сверху */}
                      <div className="absolute top-3 left-3 right-3 z-20 flex gap-1.5 pointer-events-none">
                        {currentCandidate.photos.map((_, idx) => (
                          <div
                            key={idx}
                            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                              idx === photoIndex
                                ? "bg-white shadow-md"
                                : "bg-white/40"
                            }`}
                          />
                        ))}
                      </div>

                      {/* Зоны клика по левому и правому краю для переключения фото */}
                      <div
                        onClick={handlePrevPhoto}
                        className="absolute left-0 top-0 bottom-0 w-1/3 z-10 cursor-pointer"
                        title="Предыдущее фото"
                      />
                      <div
                        onClick={(e) => handleNextPhoto(e, currentCandidate.photos.length)}
                        className="absolute right-0 top-0 bottom-0 w-1/3 z-10 cursor-pointer"
                        title="Следующее фото"
                      />

                      {/* Имя и Город поверх фото */}
                      <div className="absolute bottom-4 left-4 right-4 text-white pointer-events-none z-10">
                        <div className="flex items-baseline gap-2">
                          <h2 className="text-3xl font-black">{currentCandidate.name}</h2>
                          <span className="text-2xl font-light">{currentCandidate.age}</span>
                        </div>
                        <p className="text-sm opacity-90">📍 {currentCandidate.city}</p>
                      </div>
                    </div>

                    {/* Описание и интересы */}
                    <div className="p-5 space-y-4">
                      <p className="text-gray-700 text-sm leading-relaxed">
                        {currentCandidate.bio}
                      </p>

                      <div className="flex flex-wrap gap-1.5">
                        {currentCandidate.interests.map((tag, i) => (
                          <span
                            key={i}
                            className="rounded-full bg-pink-50 px-3 py-1 text-xs font-semibold text-pink-600"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>

                  {/* Кнопки управления */}
                  <div className="absolute -bottom-20 left-0 right-0 flex items-center justify-center gap-6">
                    <button
                      onClick={() => triggerSwipe("left")}
                      className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-gray-200 bg-white text-2xl shadow-md transition hover:scale-110 hover:border-red-400 hover:bg-red-50 active:scale-95"
                    >
                      ❌
                    </button>
                    <button
                      onClick={() => triggerSwipe("right")}
                      className="flex h-16 w-16 items-center justify-center rounded-full bg-pink-600 text-3xl text-white shadow-lg shadow-pink-600/30 transition hover:scale-110 hover:bg-pink-700 active:scale-95"
                    >
                      💚
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border bg-white p-8 text-center shadow-sm space-y-4">
                  <div className="text-5xl">🎉</div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Анкеты пока закончились!
                  </h3>
                  <p className="text-sm text-gray-500">
                    Вы просмотрели всех кандидатов поблизости.
                  </p>
                  <button
                    onClick={() => setCurrentIndex(0)}
                    className="rounded-2xl bg-pink-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-700"
                  >
                    Смотреть снова
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Правый блок: Мэтчи */}
          <aside className="col-span-1 lg:col-span-3 space-y-4 mt-20 lg:mt-0">
            <div className="rounded-3xl border bg-white p-5 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center justify-between">
                <span>Ваши мэтчи</span>
                <span className="rounded-full bg-pink-100 px-2.5 py-0.5 text-xs text-pink-600 font-extrabold">
                  {matches.length}
                </span>
              </h3>

              {matches.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">
                  Свайпайте вправо, чтобы получать мэтчи! 🔥
                </p>
              ) : (
                <div className="space-y-3">
                  {matches.map((match) => (
                    <div
                      key={match.id}
                      className="flex items-center justify-between p-2 rounded-2xl hover:bg-gray-50 transition"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={match.avatar}
                          alt={match.name}
                          className="h-10 w-10 rounded-full object-cover border-2 border-pink-500"
                        />
                        <div>
                          <h4 className="text-sm font-bold text-gray-900">
                            {match.name}, {match.age}
                          </h4>
                          <span className="text-[10px] text-gray-400">
                            Взаимная симпатия! 💕
                          </span>
                        </div>
                      </div>

                      <Link
                        href={`/messages?userId=${match.id}`}
                        onClick={() => handleGoToChat(match)}
                        className="rounded-xl bg-pink-50 p-2 text-pink-600 hover:bg-pink-100 transition text-xs font-semibold"
                      >
                        💬
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>

      {/* Модалка мэтча */}
      <AnimatePresence>
        {showMatchModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", damping: 18, stiffness: 200 }}
              className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl space-y-4 border border-pink-100"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                className="text-6xl inline-block"
              >
                💘
              </motion.div>

              <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-rose-500">
                Это Мэтч!
              </h2>

              <p className="text-sm text-gray-600">
                Вы и <strong className="text-gray-900">{showMatchModal.name}</strong> понравились друг другу!
              </p>

              <div className="flex justify-center gap-4 py-2">
                <motion.img
                  initial={{ x: -30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  src={showMatchModal.avatar}
                  alt={showMatchModal.name}
                  className="h-20 w-20 rounded-full border-4 border-pink-500 object-cover shadow-xl"
                />
              </div>

              <div className="space-y-2 pt-2">
                <Link
                  href={`/messages?userId=${showMatchModal.id}`}
                  onClick={() => handleGoToChat(showMatchModal)}
                  className="block w-full rounded-2xl bg-gradient-to-r from-pink-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-pink-600/30 hover:opacity-95 transition active:scale-95"
                >
                  Написать сообщение 💬
                </Link>
                <button
                  onClick={() => {
                    setShowMatchModal(null);
                    setCurrentIndex((prev) => prev + 1);
                  }}
                  className="w-full rounded-2xl border py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition active:scale-95"
                >
                  Продолжить смотреть
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}