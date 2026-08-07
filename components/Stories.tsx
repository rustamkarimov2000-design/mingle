"use client";

interface StoryUser {
  id: number;
  name: string;
  avatar: string;
  isOnline: boolean;
  hasStory: boolean;
}

const mockStories: StoryUser[] = [
  {
    id: 1,
    name: "Анна",
    avatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300",
    isOnline: true,
    hasStory: true,
  },
  {
    id: 2,
    name: "Мария",
    avatar:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=300",
    isOnline: true,
    hasStory: true,
  },
  {
    id: 3,
    name: "Ева",
    avatar:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=300",
    isOnline: false,
    hasStory: true,
  },
  {
    id: 4,
    name: "София",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=300",
    isOnline: true,
    hasStory: false,
  },
  {
    id: 5,
    name: "Алиса",
    avatar:
      "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=300",
    isOnline: false,
    hasStory: true,
  },
  {
    id: 6,
    name: "Кира",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=300",
    isOnline: true,
    hasStory: false,
  },
];

export default function Stories() {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Сейчас в сети
        </h2>
        <span className="text-xs font-bold text-pink-600 hover:underline cursor-pointer">
          Все онлайн →
        </span>
      </div>

      <div className="flex items-center gap-4 overflow-x-auto pb-1 scrollbar-none">
        {mockStories.map((story) => (
          <div
            key={story.id}
            className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
          >
            <div
              className={`relative p-0.5 rounded-full transition-transform duration-200 group-hover:scale-105 ${
                story.hasStory
                  ? "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600"
                  : "bg-gray-200"
              }`}
            >
              <img
                src={story.avatar}
                alt={story.name}
                className="h-14 w-14 rounded-full object-cover border-2 border-white"
              />
              {story.isOnline && (
                <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white" />
              )}
            </div>

            {/* Текст имени: контрастный тёмный цвет вместо бледного серого */}
            <span className="text-xs font-bold text-gray-900 group-hover:text-pink-600 transition-colors">
              {story.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}