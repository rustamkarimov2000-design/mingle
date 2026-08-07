type ProfileCardProps = {
  name: string;
  age: number;
  city: string;
  compatibility: number;
  image: string;
};

export default function ProfileCard({
  name,
  age,
  city,
  compatibility,
  image,
}: ProfileCardProps) {
  return (
    <div className="relative mx-auto h-[700px] w-full max-w-md overflow-hidden rounded-[36px] shadow-2xl">
      <img
        src={image}
        alt={name}
        className="absolute inset-0 h-full w-full object-cover"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

      <div className="absolute bottom-32 left-8 right-8 text-white">
        <h2 className="text-4xl font-bold">
          {name}, {age}
        </h2>

        <p className="mt-2 text-lg">
          📍 {city}
        </p>

        <p className="mt-4 text-lg text-pink-300">
          ❤️ Совместимость {compatibility}%
        </p>
      </div>

      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-6">
        <button className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl shadow-xl transition hover:scale-110">
          ❌
        </button>

        <button className="flex h-20 w-20 items-center justify-center rounded-full bg-pink-600 text-4xl text-white shadow-2xl transition hover:scale-110">
          ❤️
        </button>

        <button className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl shadow-xl transition hover:scale-110">
          ⭐
        </button>
      </div>
    </div>
  );
}