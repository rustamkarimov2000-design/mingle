type PostCardProps = {
  name: string;
  avatar: string;
  image: string;
  text: string;
  likes: number;
  comments: number;
};

export default function PostCard({
  name,
  avatar,
  image,
  text,
  likes,
  comments,
}: PostCardProps) {
  return (
    <article className="overflow-hidden rounded-3xl bg-white shadow-xl">
      {/* Верх */}
      <div className="flex items-center gap-4 p-5">
        <img
          src={avatar}
          alt={name}
          className="h-12 w-12 rounded-full object-cover"
        />

        <div>
          <h3 className="font-bold">{name}</h3>
          <p className="text-sm text-gray-500">2 минуты назад</p>
        </div>
      </div>

      {/* Фото */}
      <img
        src={image}
        alt=""
        className="h-[420px] w-full object-cover"
      />

      {/* Текст */}
      <div className="p-5">
        <p>{text}</p>

        <div className="mt-6 flex items-center gap-6 text-lg">
          <button className="transition hover:scale-110">
            ❤️ {likes}
          </button>

          <button className="transition hover:scale-110">
            💬 {comments}
          </button>

          <button className="transition hover:scale-110">
            🔁 Поделиться
          </button>
        </div>
      </div>
    </article>
  );
}