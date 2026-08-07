export default function ChatList() {
  return (
    <aside className="rounded-3xl bg-white p-6 shadow-xl">
      <h2 className="mb-6 text-xl font-bold">
        Чаты
      </h2>

      <div className="space-y-4">
        <div className="rounded-xl bg-gray-100 p-4">
          💬 Анна
        </div>

        <div className="rounded-xl bg-gray-100 p-4">
          💬 Мария
        </div>

        <div className="rounded-xl bg-gray-100 p-4">
          💬 София
        </div>
      </div>
    </aside>
  );
}