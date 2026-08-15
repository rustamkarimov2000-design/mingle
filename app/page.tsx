"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AIAssistantModal from "@/components/AIAssistantModal";

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  authorName: string;
}

interface Post {
  id: string;
  user_id: string;
  content: string;
  category: string;
  created_at: string;
  profiles?: {
    name: string;
  };
  post_likes?: { user_id: string }[];
}

interface StoryItem {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  created_at: string;
}

interface StoryGroup {
  userId: string;
  name: string;
  avatar: string;
  stories: StoryItem[];
}

const STORY_DURATION_MS = 5000;

export default function HomePage() {
  const router = useRouter();
  const supabase = createClient();

  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [postText, setPostText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Общение");
  const [feedCategory, setFeedCategory] = useState("Все");

  const [displayName, setDisplayName] = useState("Гость");
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isAnonChatOpen, setIsAnonChatOpen] = useState(false);
  const [anonStatus, setAnonStatus] = useState<"idle" | "searching" | "chatting">("idle");
  const [anonMessages, setAnonMessages] = useState<{ sender: "me" | "them"; text: string }[]>([]);
  const [inputAnonMessage, setInputAnonMessage] = useState("");

  const [unreadCount, setUnreadCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);

  // Комментарии
  const [commentsByPost, setCommentsByPost] = useState<Record<string, Comment[]>>({});
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [submittingComment, setSubmittingComment] = useState<Set<string>>(new Set());

  // Истории
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [isUploadingStory, setIsUploadingStory] = useState(false);
  const storyFileInputRef = useRef<HTMLInputElement>(null);

  const [viewerGroupIndex, setViewerGroupIndex] = useState<number | null>(null);
  const [viewerStoryIndex, setViewerStoryIndex] = useState(0);
  const [viewerProgress, setViewerProgress] = useState(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        setDisplayName("Гость");
        setUserId(null);
        setIsLoaded(true);
        return;
      }

      setUserId(authUser.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", authUser.id)
        .single();

      setDisplayName(profile?.name || authUser.email?.split("@")[0] || "Пользователь");
      setIsLoaded(true);
    };

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) return;

    let conversationIds: string[] = [];

    const loadUnreadCount = async () => {
      const { data: matches1 } = await supabase
        .from("matches")
        .select("id")
        .eq("user1_id", userId);

      const { data: matches2 } = await supabase
        .from("matches")
        .select("id")
        .eq("user2_id", userId);

      const matchIds = [
        ...(matches1 || []).map((m) => m.id),
        ...(matches2 || []).map((m) => m.id),
      ];

      if (matchIds.length === 0) {
        setUnreadCount(0);
        return;
      }

      const { data: conversations } = await supabase
        .from("conversations")
        .select("id")
        .in("match_id", matchIds);

      conversationIds = conversations?.map((c) => c.id) || [];

      if (conversationIds.length === 0) {
        setUnreadCount(0);
        return;
      }

      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", conversationIds)
        .eq("is_read", false)
        .neq("sender_id", userId);

      setUnreadCount(count || 0);
    };

    loadUnreadCount();

    const channel = supabase
      .channel("home_unread_messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = payload.new as { conversation_id: string; sender_id: string };
          if (
            newMsg.sender_id !== userId &&
            conversationIds.includes(newMsg.conversation_id)
          ) {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const loadLikesCount = async () => {
      const { count } = await supabase
        .from("likes")
        .select("id", { count: "exact", head: true })
        .eq("to_user_id", userId);

      setLikesCount(count || 0);
    };

    loadLikesCount();

    const channel = supabase
      .channel("home_incoming_likes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "likes" },
        (payload) => {
          const newLike = payload.new as { to_user_id: string };
          if (newLike.to_user_id === userId) {
            setLikesCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Загрузка историй
  const loadStories = useCallback(async () => {
    const { data: storiesData, error } = await supabase
      .from("stories")
      .select("id, user_id, media_url, media_type, created_at")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Ошибка загрузки историй:", error);
      return;
    }

    if (!storiesData || storiesData.length === 0) {
      setStoryGroups([]);
      return;
    }

    const userIds = Array.from(new Set(storiesData.map((s) => s.user_id)));

    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, name, avatar_url, avatar")
      .in("id", userIds);

    const profilesMap = new Map(
      (profilesData || []).map((p) => [p.id, p])
    );

    const groupsMap = new Map<string, StoryGroup>();

    storiesData.forEach((story) => {
      const profile = profilesMap.get(story.user_id);
      if (!profile) return;

      if (!groupsMap.has(story.user_id)) {
        groupsMap.set(story.user_id, {
          userId: story.user_id,
          name: profile.name || "Пользователь",
          avatar:
            profile.avatar_url ||
            profile.avatar ||
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
          stories: [],
        });
      }

      groupsMap.get(story.user_id)!.stories.push(story);
    });

    groupsMap.forEach((group) => {
      group.stories.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });

    setStoryGroups(Array.from(groupsMap.values()));
  }, []);

  useEffect(() => {
    if (isLoaded) {
      loadStories();
    }
  }, [isLoaded, loadStories]);

  const handleCreateStoryClick = () => {
    storyFileInputRef.current?.click();
  };

  const handleStoryFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    const isVideo = file.type.startsWith("video/");
    const mediaType = isVideo ? "video" : "image";

    try {
      setIsUploadingStory(true);

      const fileExt = file.name.split(".").pop();
      const filePath = userId + "/" + Date.now() + "." + fileExt;

      const { error: uploadError } = await supabase.storage
        .from("stories")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("stories").getPublicUrl(filePath);

      const { error: insertError } = await supabase.from("stories").insert({
        user_id: userId,
        media_url: publicUrl,
        media_type: mediaType,
      });

      if (insertError) throw insertError;

      await loadStories();
    } catch (err: any) {
      console.error("Ошибка загрузки истории:", err);
      alert("Не удалось загрузить историю: " + (err.message || "неизвестная ошибка"));
    } finally {
      setIsUploadingStory(false);
      if (storyFileInputRef.current) {
        storyFileInputRef.current.value = "";
      }
    }
  };

  const openViewer = (groupIndex: number) => {
    setViewerGroupIndex(groupIndex);
    setViewerStoryIndex(0);
    setViewerProgress(0);
  };

  const closeViewer = () => {
    setViewerGroupIndex(null);
    setViewerStoryIndex(0);
    setViewerProgress(0);
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
  };

  const goToNextStory = useCallback(() => {
    if (viewerGroupIndex === null) return;

    const currentGroup = storyGroups[viewerGroupIndex];
    if (!currentGroup) return;

    if (viewerStoryIndex < currentGroup.stories.length - 1) {
      setViewerStoryIndex((prev) => prev + 1);
      setViewerProgress(0);
    } else if (viewerGroupIndex < storyGroups.length - 1) {
      setViewerGroupIndex((prev) => (prev !== null ? prev + 1 : null));
      setViewerStoryIndex(0);
      setViewerProgress(0);
    } else {
      closeViewer();
    }
  }, [viewerGroupIndex, viewerStoryIndex, storyGroups]);

  const goToPrevStory = () => {
    if (viewerGroupIndex === null) return;

    if (viewerStoryIndex > 0) {
      setViewerStoryIndex((prev) => prev - 1);
      setViewerProgress(0);
    } else if (viewerGroupIndex > 0) {
      const prevGroup = storyGroups[viewerGroupIndex - 1];
      setViewerGroupIndex((prev) => (prev !== null ? prev - 1 : null));
      setViewerStoryIndex(prevGroup.stories.length - 1);
      setViewerProgress(0);
    }
  };

  useEffect(() => {
    if (viewerGroupIndex === null) return;

    const currentGroup = storyGroups[viewerGroupIndex];
    const currentStory = currentGroup?.stories[viewerStoryIndex];

    if (!currentStory) return;

    if (currentStory.media_type === "video") {
      return;
    }

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    const stepMs = 100;
    const steps = STORY_DURATION_MS / stepMs;
    let currentStep = 0;

    progressIntervalRef.current = setInterval(() => {
      currentStep += 1;
      const pct = (currentStep / steps) * 100;
      setViewerProgress(pct);

      if (pct >= 100) {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
        goToNextStory();
      }
    }, stepMs);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [viewerGroupIndex, viewerStoryIndex, storyGroups, goToNextStory]);

  const fetchPosts = useCallback(async () => {
    setIsLoadingPosts(true);

    try {
      let query = supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false });

      if (feedCategory !== "Все") {
        query = query.eq("category", feedCategory);
      }

      const { data: postsData, error: postsError } = await query;

      if (postsError) {
        console.error("Ошибка загрузки постов:", postsError);
        setIsLoadingPosts(false);
        return;
      }

      if (!postsData || postsData.length === 0) {
        setPosts([]);
        setIsLoadingPosts(false);
        return;
      }

      const userIds = Array.from(new Set(postsData.map((p) => p.user_id)));
      const postIds = postsData.map((p) => p.id);

      const [profilesRes, likesRes, commentsRes] = await Promise.all([
        supabase.from("profiles").select("id, name").in("id", userIds),
        supabase.from("post_likes").select("post_id, user_id").in("post_id", postIds),
        supabase
          .from("post_comments")
          .select("id, post_id, user_id, content, created_at")
          .in("post_id", postIds)
          .order("created_at", { ascending: true }),
      ]);

      const profilesMap = new Map(profilesRes.data?.map((p) => [p.id, p.name]));
      const likesData = likesRes.data || [];
      const commentsData = commentsRes.data || [];

      const commenterIds = Array.from(new Set(commentsData.map((c) => c.user_id)));
      const { data: commenterProfiles } = commenterIds.length
        ? await supabase.from("profiles").select("id, name").in("id", commenterIds)
        : { data: [] as { id: string; name: string }[] };

      const commenterMap = new Map((commenterProfiles || []).map((p) => [p.id, p.name]));

      const commentsMap: Record<string, Comment[]> = {};
      commentsData.forEach((c) => {
        const enriched: Comment = {
          ...c,
          authorName: commenterMap.get(c.user_id) || "Пользователь",
        };
        if (!commentsMap[c.post_id]) commentsMap[c.post_id] = [];
        commentsMap[c.post_id].push(enriched);
      });
      setCommentsByPost(commentsMap);

      const formattedPosts: Post[] = postsData.map((post) => ({
        ...post,
        profiles: {
          name: profilesMap.get(post.user_id) || "Пользователь",
        },
        post_likes: likesData.filter((l) => l.post_id === post.id),
      }));

      setPosts(formattedPosts);
    } catch (err) {
      console.error("Системная ошибка при загрузке постов:", err);
    } finally {
      setIsLoadingPosts(false);
    }
  }, [feedCategory]);

  useEffect(() => {
    if (isLoaded) {
      fetchPosts();
    }
  }, [isLoaded, fetchPosts]);

  const handleToggleLike = async (postId: string, isLiked: boolean) => {
    if (!userId) {
      router.push("/auth/login");
      return;
    }

    setPosts((prevPosts) =>
      prevPosts.map((post) => {
        if (post.id === postId) {
          const currentLikes = post.post_likes || [];
          const updatedLikes = isLiked
            ? currentLikes.filter((like) => like.user_id !== userId)
            : [...currentLikes, { user_id: userId }];

          return { ...post, post_likes: updatedLikes };
        }
        return post;
      })
    );

    try {
      if (isLiked) {
        const { error } = await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("post_likes").insert({
          post_id: postId,
          user_id: userId,
        });

        if (error) throw error;
      }
    } catch (error) {
      console.error("Ошибка обновления лайка:", error);
      fetchPosts();
    }
  };

  const handleCreatePost = async () => {
    if (!postText.trim() || isSubmitting) return;

    if (!userId) {
      router.push("/auth/login");
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.from("posts").insert({
      user_id: userId,
      content: postText.trim(),
      category: selectedCategory,
    });

    if (error) {
      console.error("Ошибка при создании поста:", error);
      alert(`Не удалось опубликовать пост: ${error.message}`);
    } else {
      setPostText("");
      await fetchPosts();
    }

    setIsSubmitting(false);
  };

  const toggleComments = (postId: string) => {
    setOpenComments((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  };

  const handleCommentDraftChange = (postId: string, value: string) => {
    setCommentDrafts((prev) => ({ ...prev, [postId]: value }));
  };

  const handleAddComment = async (postId: string) => {
    if (!userId) {
      router.push("/auth/login");
      return;
    }

    const text = (commentDrafts[postId] || "").trim();
    if (!text) return;

    setSubmittingComment((prev) => new Set(prev).add(postId));

    const { data, error } = await supabase
      .from("post_comments")
      .insert({
        post_id: postId,
        user_id: userId,
        content: text,
      })
      .select()
      .single();

    if (error) {
      console.error("Ошибка добавления комментария:", error);
      alert("Не удалось добавить комментарий: " + error.message);
    } else if (data) {
      const newComment: Comment = {
        ...data,
        authorName: displayName,
      };

      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newComment],
      }));

      setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
    }

    setSubmittingComment((prev) => {
      const next = new Set(prev);
      next.delete(postId);
      return next;
    });
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      router.push("/auth/login");
      router.refresh();
    }
  };

  const handleToggleAnonChat = () => {
    if (!isAnonChatOpen) {
      setIsAnonChatOpen(true);
      startAnonSearch();
    } else {
      setIsAnonChatOpen(false);
      setAnonStatus("idle");
    }
  };

  const startAnonSearch = () => {
    setAnonStatus("searching");
    setAnonMessages([]);
    setTimeout(() => {
      setAnonStatus("chatting");
      setAnonMessages([
        { sender: "them", text: "Привет! С кем общаюсь? Назови 3 свои любимые песни 😉" },
      ]);
    }, 2500);
  };

  const sendAnonMessage = () => {
    if (!inputAnonMessage.trim()) return;
    setAnonMessages((prev) => [...prev, { sender: "me", text: inputAnonMessage }]);
    setInputAnonMessage("");
  };

  if (!isLoaded) return null;

  const activeGroup = viewerGroupIndex !== null ? storyGroups[viewerGroupIndex] : null;
  const activeStory = activeGroup ? activeGroup.stories[viewerStoryIndex] : null;

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-800 font-sans pb-12">
      <header className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
         <span className="font-logo text-xl text-gray-900">mingle</span>
          <span className="text-xs text-gray-400 font-medium">здесь общаются</span>
        </div>

        <div className="flex items-center gap-3">
          {displayName !== "Гость" ? (
            <>
              <div className="flex items-center bg-gray-100 rounded-full p-1 text-xs font-bold">
                <span className="bg-pink-500 text-white px-2.5 py-1 rounded-full uppercase text-[10px]">
                  {displayName.slice(0, 2)}
                </span>
                <span className="px-3 text-gray-800 uppercase tracking-wider">{displayName}</span>
              </div>
              <button
                onClick={handleLogout}
                className="text-xs text-gray-500 hover:text-gray-900 font-medium px-3 py-1.5 rounded-full border border-gray-200 bg-white cursor-pointer"
              >
                Выйти
              </button>
            </>
          ) : (
            <Link
              href="/auth/login"
              className="text-xs text-white font-bold px-4 py-2 rounded-full bg-pink-600 hover:bg-pink-700 transition"
            >
              Войти
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-4 grid grid-cols-12 gap-6">
        <aside className="col-span-12 md:col-span-3 space-y-2">
          <div className="bg-white rounded-3xl p-3 shadow-xs border border-gray-100 space-y-1 sticky top-4">
            <Link href="/" className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-gray-100 font-bold text-xs text-gray-900">
              🏠 Главная
            </Link>
            <Link href="/discover" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-gray-50 font-bold text-xs text-gray-600 transition">
              🔥 Мэтчи
            </Link>
            <Link href="/likes" className="flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-gray-50 font-bold text-xs text-gray-600 transition">
              <span className="flex items-center gap-3">💌 Лайки</span>
              {likesCount > 0 && (
                <span className="bg-pink-600 text-white text-[10px] font-black min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                  {likesCount > 9 ? "9+" : likesCount}
                </span>
              )}
            </Link>
            <Link href="/people" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-gray-50 font-bold text-xs text-gray-600 transition">
              👥 Люди
            </Link>
            <Link href="/messages" className="flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-gray-50 font-bold text-xs text-gray-600 transition">
              <span className="flex items-center gap-3">💬 Сообщения</span>
              {unreadCount > 0 && (
                <span className="bg-pink-600 text-white text-[10px] font-black min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
            <Link href="/profile" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-gray-50 font-bold text-xs text-gray-600 transition">
              👤 Мой профиль
            </Link>
          </div>
        </aside>

        <section className="col-span-12 md:col-span-9 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#EFA1A4] rounded-3xl p-5 text-white flex flex-col justify-between h-40 shadow-xs">
              <span className="text-[10px] uppercase tracking-wider font-extrabold opacity-90">
                👋 ЗДРАВСТВУЙТЕ
              </span>
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-1 truncate">
                  {displayName.toUpperCase()} 👋
                </h2>
                <p className="text-[11px] leading-snug mt-1 opacity-90">
                  Сегодня отличный день для знакомств.
                </p>
              </div>
            </div>

            <Link
              href="/discover"
              className="bg-[#93B497] rounded-3xl p-5 text-white flex flex-col justify-center items-center text-center h-40 shadow-xs hover:opacity-95 transition cursor-pointer"
            >
              <span className="text-2xl mb-1">🔥</span>
              <h3 className="text-base font-black">Смотреть людей</h3>
              <p className="text-[11px] opacity-90 mt-1">Начни свайпать</p>
            </Link>

            <div className="bg-[#B3A1C9] rounded-3xl p-5 text-white flex flex-col justify-between h-40 shadow-xs relative">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs font-black flex items-center gap-1">🤖 AI Помощник</h3>
                  <span className="bg-white/30 text-[9px] font-bold px-2 py-0.5 rounded-full">Онлайн</span>
                </div>
                <p className="text-[10px] leading-tight opacity-90">
                  Помогу оформить профиль и подберу первое сообщение.
                </p>
              </div>

              <button
                onClick={() => setIsAIModalOpen(true)}
                className="w-full bg-white/30 hover:bg-white/40 text-white font-bold py-2 rounded-xl text-xs backdrop-blur-md transition cursor-pointer text-center"
              >
                Открыть AI
              </button>
            </div>
          </div>

          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-4 sm:p-5 text-white shadow-md border border-slate-800 transition-all duration-300">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-lg shadow-inner shrink-0">
                  🎭
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-black tracking-wider uppercase">Анонимные Чаты</h3>
                    <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      142 онлайн
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    Случайный собеседник без фото и анкеты. Полная тайна!
                  </p>
                </div>
              </div>

              <button
                onClick={handleToggleAnonChat}
                className={`w-full sm:w-auto font-bold px-5 py-2.5 rounded-2xl text-xs transition cursor-pointer text-center whitespace-nowrap shrink-0 ${
                  isAnonChatOpen
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30"
                    : "bg-white/10 hover:bg-white/20 border border-white/15 text-white"
                }`}
              >
                {isAnonChatOpen ? "Закрыть чат ✕" : "Войти в чат 🚀"}
              </button>
            </div>

            {isAnonChatOpen && (
              <div className="mt-4 pt-4 border-t border-slate-800/80">
                {anonStatus === "searching" && (
                  <div className="py-8 flex flex-col items-center justify-center space-y-3">
                    <div className="relative w-10 h-10 flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full border-2 border-pink-500 animate-ping opacity-75" />
                      <div className="w-8 h-8 rounded-full bg-purple-600/50 flex items-center justify-center text-base">
                        🔍
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-300">Ищем анонимного собеседника...</span>
                  </div>
                )}

                {anonStatus === "chatting" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-slate-800/60 rounded-2xl px-4 py-2 text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="font-bold text-slate-200">Собеседник найден (#8492)</span>
                      </div>
                      <button
                        onClick={startAnonSearch}
                        className="text-pink-400 hover:text-pink-300 font-bold transition cursor-pointer"
                      >
                        Следующий 🔄
                      </button>
                    </div>

                    <div className="h-44 overflow-y-auto space-y-2 pr-2 bg-slate-950/40 p-3 rounded-2xl border border-slate-800/50">
                      {anonMessages.map((msg, i) => (
                        <div
                          key={i}
                          className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs ${
                              msg.sender === "me"
                                ? "bg-pink-600 text-white rounded-br-none"
                                : "bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700/50"
                            }`}
                          >
                            {msg.text}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={inputAnonMessage}
                        onChange={(e) => setInputAnonMessage(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendAnonMessage()}
                        placeholder="Напишите анонимное сообщение..."
                        className="flex-1 bg-slate-800/80 border border-slate-700/60 rounded-2xl px-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-pink-500"
                      />
                      <button
                        onClick={sendAnonMessage}
                        className="bg-pink-600 hover:bg-pink-500 text-white font-bold px-4 py-2 rounded-2xl text-xs transition cursor-pointer"
                      >
                        Отправить
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ИСТОРИИ */}
          <div className="bg-white rounded-3xl p-5 shadow-xs border border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">📸</span>
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-900">
                  ИСТОРИИ
                </h3>
              </div>
              <span className="text-[10px] text-gray-400 font-medium">Свежее</span>
            </div>

            <div className="flex items-center gap-3 overflow-x-auto pb-1">
              <div
                onClick={handleCreateStoryClick}
                className="flex flex-col items-center gap-1 min-w-[46px] cursor-pointer"
              >
                <div className="w-11 h-11 rounded-full border-2 border-dashed border-pink-400 bg-pink-50 flex items-center justify-center text-pink-600 font-bold text-sm">
                  {isUploadingStory ? (
                    <span className="text-[9px]">...</span>
                  ) : (
                    "+"
                  )}
                </div>
                <span className="text-[10px] text-gray-600 font-medium">Создать</span>
              </div>

              <input
                ref={storyFileInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={handleStoryFileSelected}
              />

              {storyGroups.map((group, idx) => (
                <div
                  key={group.userId}
                  onClick={() => openViewer(idx)}
                  className="flex flex-col items-center gap-1 min-w-[46px] cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-full p-[2px] bg-gradient-to-tr from-pink-500 to-purple-500">
                    <img
                      src={group.avatar}
                      alt={group.name}
                      className="w-full h-full object-cover rounded-full"
                    />
                  </div>
                  <span className="text-[10px] font-bold text-gray-700 truncate max-w-[46px]">
                    {group.name}
                  </span>
                </div>
              ))}

              {storyGroups.length === 0 && (
                <span className="text-[11px] text-gray-400 pl-2">
                  Пока никто не опубликовал историю
                </span>
              )}
            </div>
          </div>

          {/* СОЗДАНИЕ ПОСТА */}
          <div className="bg-white rounded-3xl p-5 shadow-xs border border-gray-100 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-pink-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                {displayName.slice(0, 2).toUpperCase()}
              </div>
              <input
                type="text"
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreatePost()}
                placeholder="О чем хотите рассказать?"
                className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-2 text-xs focus:outline-none focus:border-pink-300"
              />
              <button
                onClick={handleCreatePost}
                disabled={isSubmitting || !postText.trim()}
                className="bg-[#E02868] hover:bg-pink-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-2xl transition cursor-pointer shrink-0"
              >
                {isSubmitting ? "Публикация..." : "Опубликовать"}
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-xs overflow-x-auto">
              <span className="text-gray-400 font-medium text-[10px]">Категория:</span>
              {["Дружба", "Свидания", "Общение", "Интересы"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium transition cursor-pointer whitespace-nowrap ${
                    selectedCategory === cat
                      ? "bg-black text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {[
                { name: "Все", icon: "✨" },
                { name: "Дружба", icon: "🤝" },
                { name: "Свидания", icon: "❤️" },
                { name: "Общение", icon: "💬" },
                { name: "Интересы", icon: "🎨" },
              ].map((f) => (
                <button
                  key={f.name}
                  onClick={() => setFeedCategory(f.name)}
                  className={`px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                    feedCategory === f.name
                      ? "bg-[#E02868] text-white shadow-xs"
                      : "bg-white text-gray-600 border border-gray-100 hover:bg-gray-50"
                  }`}
                >
                  <span>{f.icon}</span> {f.name}
                </button>
              ))}
            </div>

            {isLoadingPosts ? (
              <div className="bg-white rounded-3xl p-8 text-center text-xs text-gray-400 border border-gray-100">
                Загрузка ленты...
              </div>
            ) : posts.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center text-xs text-gray-400 border border-gray-100 space-y-1">
                <p className="font-bold text-gray-600 text-sm">В этой категории пока нет постов 💭</p>
                <p>Будьте первым, кто поделится чем-то интересным!</p>
              </div>
            ) : (
              posts.map((post) => {
                const isLiked = (post.post_likes || []).some((like) => like.user_id === userId);
                const likesOnPost = post.post_likes?.length || 0;
                const postComments = commentsByPost[post.id] || [];
                const isCommentsOpen = openComments.has(post.id);
                const isCommentSubmitting = submittingComment.has(post.id);

                return (
                  <div key={post.id} className="bg-white rounded-3xl p-5 shadow-xs border border-gray-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-xs uppercase">
                          {(post.profiles?.name || "П").slice(0, 2)}
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-gray-900">{post.profiles?.name || "Пользователь"}</h4>
                          <span className="text-[10px] text-gray-400">
                            {new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-3 py-1 rounded-full">
                        {post.category}
                      </span>
                    </div>

                    <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {post.content}
                    </p>

                    <div className="flex items-center gap-4 text-xs font-medium text-gray-400 pt-2 border-t border-gray-50">
                      <button
                        onClick={() => handleToggleLike(post.id, isLiked)}
                        className={`flex items-center gap-1.5 transition cursor-pointer font-bold ${
                          isLiked ? "text-pink-600" : "text-gray-500 hover:text-pink-600"
                        }`}
                      >
                        <span className="text-sm">{isLiked ? "💖" : "🤍"}</span>
                        <span>{likesOnPost}</span>
                      </button>
                      <button
                        onClick={() => toggleComments(post.id)}
                        className="flex items-center gap-1 hover:text-gray-600 transition cursor-pointer"
                      >
                        💬 {isCommentsOpen ? "Скрыть" : "Комментировать"}
                        {postComments.length > 0 && " (" + postComments.length + ")"}
                      </button>
                    </div>

                    {isCommentsOpen && (
                      <div className="pt-3 border-t border-gray-50 space-y-3">
                        {postComments.length === 0 ? (
                          <p className="text-[11px] text-gray-400 italic">
                            Пока нет комментариев. Будьте первым!
                          </p>
                        ) : (
                          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                            {postComments.map((comment) => (
                              <div key={comment.id} className="flex items-start gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-600 font-bold flex items-center justify-center text-[10px] uppercase shrink-0">
                                  {comment.authorName.slice(0, 2)}
                                </div>
                                <div className="bg-gray-50 rounded-2xl px-3 py-2 flex-1">
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-[11px] font-bold text-gray-900">
                                      {comment.authorName}
                                    </span>
                                    <span className="text-[9px] text-gray-400">
                                      {new Date(comment.created_at).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-gray-700 mt-0.5 whitespace-pre-wrap">
                                    {comment.content}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={commentDrafts[post.id] || ""}
                            onChange={(e) => handleCommentDraftChange(post.id, e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAddComment(post.id)}
                            placeholder="Написать комментарий..."
                            className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-3 py-2 text-[11px] focus:outline-none focus:border-pink-300"
                          />
                          <button
                            onClick={() => handleAddComment(post.id)}
                            disabled={isCommentSubmitting || !(commentDrafts[post.id] || "").trim()}
                            className="bg-pink-500 hover:bg-pink-600 disabled:opacity-40 text-white text-[11px] font-bold px-3.5 py-2 rounded-2xl transition cursor-pointer shrink-0"
                          >
                            {isCommentSubmitting ? "..." : "Отправить"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>

      <AIAssistantModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
      />

      {activeGroup && activeStory && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
          <div className="relative w-full max-w-md h-full sm:h-[90vh] sm:rounded-3xl overflow-hidden bg-black">
            <div className="absolute top-3 left-3 right-3 z-30 flex gap-1.5">
              {activeGroup.stories.map((s, idx) => (
                <div key={s.id} className="h-1 flex-1 rounded-full bg-white/30 overflow-hidden">
                  <div
                    className="h-full bg-white"
                    style={{
                      width:
                        idx < viewerStoryIndex
                          ? "100%"
                          : idx === viewerStoryIndex
                          ? viewerProgress + "%"
                          : "0%",
                      transition: idx === viewerStoryIndex ? "none" : undefined,
                    }}
                  />
                </div>
              ))}
            </div>

            <div className="absolute top-7 left-3 right-3 z-30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img
                  src={activeGroup.avatar}
                  alt={activeGroup.name}
                  className="w-8 h-8 rounded-full object-cover border border-white/50"
                />
                <span className="text-white text-xs font-bold drop-shadow">
                  {activeGroup.name}
                </span>
              </div>

              <button
                onClick={closeViewer}
                className="text-white text-xl font-bold px-2 drop-shadow cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="w-full h-full flex items-center justify-center">
              {activeStory.media_type === "video" ? (
                <video
                  key={activeStory.id}
                  src={activeStory.media_url}
                  className="w-full h-full object-contain"
                  autoPlay
                  playsInline
                  onEnded={goToNextStory}
                />
              ) : (
                <img
                  key={activeStory.id}
                  src={activeStory.media_url}
                  alt=""
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            <div
              onClick={goToPrevStory}
              className="absolute left-0 top-0 bottom-0 w-1/3 cursor-pointer z-20"
            />
            <div
              onClick={goToNextStory}
              className="absolute right-0 top-0 bottom-0 w-1/3 cursor-pointer z-20"
            />
          </div>
        </div>
      )}
    </div>
  );
}
