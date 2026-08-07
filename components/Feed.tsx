"use client";

import { useState } from "react";

interface Comment {
  id: number;
  author: string;
  avatar: string;
  text: string;
  createdAt: string;
}

interface Post {
  id: number;
  author: string;
  avatar: string;
  time: string;
  content: string;
  likes: number;
  isLiked: boolean;
  comments: Comment[];
  isCommentsOpen?: boolean;
}

interface FeedProps {
  user?: { name: string; avatar: string } | null;
}

export default function Feed({ user }: FeedProps) {
  const [newPostText, setNewPostText] = useState("");
  const [commentInputs, setCommentInputs] = useState<{ [postId: number]: string }>({});

  const [posts, setPosts] = useState<Post[]>([
    {
      id: 1,
      author: "Екатерина Иванова",
      avatar: "https://ui-avatars.com/api/?name=Екатерина+Иванова&background=f472b6&color=fff",
      time: "2 часа назад",
      content: "Запустили новый дизайн в Mingle! 🚀 Как вам обновление?",
      likes: 12,
      isLiked: false,
      comments: [
        {
          id: 101,
          author: "Дмитрий Петров",
          avatar: "https://ui-avatars.com/api/?name=Дмитрий+Петров&background=60a5fa&color=fff",
          text: "Дизайн супер, очень свежо смотрится!",
          createdAt: "1 час назад",
        },
      ],
      isCommentsOpen: false,
    },
    {
      id: 2,
      author: "Дмитрий Петров",
      avatar: "https://ui-avatars.com/api/?name=Дмитрий+Петров&background=60a5fa&color=fff",
      time: "5 часов назад",
      content: "Кто сегодня свободен вечером выпить кофе и обсудить Next.js App Router? ☕",
      likes: 5,
      isLiked: false,
      comments: [],
      isCommentsOpen: false,
    },
  ]);

  // Создание нового поста
  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostText.trim()) return;

    const newPost: Post = {
      id: Date.now(),
      author: user ? user.name : "Гость",
      avatar: user
        ? user.avatar
        : "https://ui-avatars.com/api/?name=Гость&background=9ca3af&color=fff",
      time: "Только что",
      content: newPostText,
      likes: 0,
      isLiked: false,
      comments: [],
      isCommentsOpen: false,
    };

    setPosts([newPost, ...posts]);
    setNewPostText("");
  };

  // Переключение лайка
  const handleLike = (postId: number) => {
    setPosts(
      posts.map((post) => {
        if (post.id === postId) {
          return {
            ...post,
            likes: post.isLiked ? post.likes - 1 : post.likes + 1,
            isLiked: !post.isLiked,
          };
        }
        return post;
      })
    );
  };

  // Переключение отображения комментариев
  const toggleComments = (postId: number) => {
    setPosts(
      posts.map((post) =>
        post.id === postId
          ? { ...post, isCommentsOpen: !post.isCommentsOpen }
          : post
      )
    );
  };

  // Изменение текста комментария для конкретного поста
  const handleCommentInputChange = (postId: number, text: string) => {
    setCommentInputs((prev) => ({ ...prev, [postId]: text }));
  };

  // Добавление нового комментария
  const handleAddComment = (e: React.FormEvent, postId: number) => {
    e.preventDefault();
    const commentText = commentInputs[postId];
    if (!commentText || !commentText.trim()) return;

    const newComment: Comment = {
      id: Date.now(),
      author: user ? user.name : "Гость",
      avatar: user
        ? user.avatar
        : "https://ui-avatars.com/api/?name=Гость&background=9ca3af&color=fff",
      text: commentText,
      createdAt: "Только что",
    };

    setPosts(
      posts.map((post) => {
        if (post.id === postId) {
          return {
            ...post,
            comments: [...post.comments, newComment],
            isCommentsOpen: true, // Автоматически открываем список при добавлении
          };
        }
        return post;
      })
    );

    // Очищаем инпут
    setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
  };

  return (
    <div className="space-y-6">
      {/* Форма создания поста */}
      <div className="rounded-3xl border bg-white p-5 shadow-sm">
        <form onSubmit={handleCreatePost} className="space-y-3">
          <div className="flex items-center gap-3">
            <img
              src={
                user
                  ? user.avatar
                  : "https://ui-avatars.com/api/?name=Гость&background=9ca3af&color=fff"
              }
              alt={user ? user.name : "Гость"}
              className="h-10 w-10 rounded-full border object-cover"
            />
            <input
              type="text"
              value={newPostText}
              onChange={(e) => setNewPostText(e.target.value)}
              placeholder={
                user
                  ? `${user.name}, что у вас нового?`
                  : "Поделитесь мыслями..."
              }
              className="w-full rounded-2xl border bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-pink-500 focus:bg-white transition"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-2xl bg-pink-600 px-5 py-2 text-sm font-semibold text-white hover:bg-pink-700 transition active:scale-95"
            >
              Опубликовать
            </button>
          </div>
        </form>
      </div>

      {/* Список постов */}
      {posts.map((post) => (
        <article
          key={post.id}
          className="rounded-3xl border bg-white p-6 shadow-sm space-y-4"
        >
          {/* Шапка поста */}
          <div className="flex items-center gap-3">
            <img
              src={post.avatar}
              alt={post.author}
              className="h-11 w-11 rounded-full border object-cover"
            />
            <div>
              <h4 className="font-bold text-gray-900 text-sm">{post.author}</h4>
              <span className="text-xs text-gray-400">{post.time}</span>
            </div>
          </div>

          {/* Контент */}
          <p className="text-gray-800 text-sm leading-relaxed">{post.content}</p>

          {/* Кнопки действий */}
          <div className="flex items-center gap-6 border-t pt-3 text-xs font-semibold text-gray-500">
            <button
              onClick={() => handleLike(post.id)}
              className={`flex items-center gap-1.5 transition ${
                post.isLiked ? "text-pink-600" : "hover:text-pink-600"
              }`}
            >
              <span>{post.isLiked ? "❤️" : "🤍"}</span>
              <span>{post.likes}</span>
            </button>

            <button
              onClick={() => toggleComments(post.id)}
              className="flex items-center gap-1.5 hover:text-pink-600 transition"
            >
              <span>💬</span>
              <span>
                {post.comments.length > 0
                  ? `${post.comments.length} коммент.`
                  : "Комментировать"}
              </span>
            </button>
          </div>

          {/* Раскрывающийся блок комментариев */}
          {post.isCommentsOpen && (
            <div className="border-t pt-4 space-y-4 animate-fade-in">
              {/* Список уже созданных комментариев */}
              {post.comments.length > 0 && (
                <div className="space-y-3 pl-2">
                  {post.comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3 items-start">
                      <img
                        src={comment.avatar}
                        alt={comment.author}
                        className="h-8 w-8 rounded-full border object-cover mt-0.5"
                      />
                      <div className="rounded-2xl bg-gray-50 p-3 text-xs flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-gray-900">
                            {comment.author}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {comment.createdAt}
                          </span>
                        </div>
                        <p className="text-gray-700 leading-relaxed">
                          {comment.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Инпут для нового комментария */}
              <form
                onSubmit={(e) => handleAddComment(e, post.id)}
                className="flex items-center gap-2 pt-1"
              >
                <input
                  type="text"
                  value={commentInputs[post.id] || ""}
                  onChange={(e) =>
                    handleCommentInputChange(post.id, e.target.value)
                  }
                  placeholder="Написать комментарий..."
                  className="w-full rounded-2xl border bg-gray-50 px-3.5 py-2 text-xs outline-none focus:border-pink-500 focus:bg-white transition"
                />
                <button
                  type="submit"
                  className="rounded-2xl bg-pink-600 px-4 py-2 text-xs font-semibold text-white hover:bg-pink-700 transition active:scale-95"
                >
                  Отправить
                </button>
              </form>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}