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
  parent_comment_id: string | null;
  image_url?: string | null;
}

interface Post {
  id: string;
  user_id: string;
  content: string;
  category: string;
  created_at: string;
  image_url?: string | null;
  profiles?: {
    name: string;
  };
  post_likes?: { user_id: string; reaction_type?: string }[];
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

interface RepostTarget {
  matchId: string;
  conversationId: string;
  name: string;
  avatar: string;
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

  const [unreadCount, setUnreadCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);

  // 🔔 Количество непрочитанных уведомлений
  const [notificationsCount, setNotificationsCount] = useState(0);

  const [commentsByPost, setCommentsByPost] = useState<Record<string, Comment[]>>({});
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [submittingComment, setSubmittingComment] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<Record<string, string | null>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [submittingReply, setSubmittingReply] = useState<Set<string>>(new Set());

  const [postImageFile, setPostImageFile] = useState<File | null>(null);
  const [postImagePreview, setPostImagePreview] = useState<string | null>(null);
  const postImageInputRef = useRef<HTMLInputElement>(null);

  const [commentImageFiles, setCommentImageFiles] = useState<Record<string, File | null>>({});
  const [commentImagePreviews, setCommentImagePreviews] = useState<Record<string, string>>({});

  // Реакции на посты (набор эмодзи вместо одного лайка)
  const [openReactionPickerId, setOpenReactionPickerId] = useState<string | null>(null);
  const REACTION_OPTIONS: { type: string; emoji: string }[] = [
    { type: "love", emoji: "💖" },
    { type: "fire", emoji: "🔥" },
    { type: "haha", emoji: "😂" },
    { type: "wow", emoji: "😮" },
    { type: "like", emoji: "👍" },
  ];

  const [repostPostId, setRepostPostId] = useState<string | null>(null);
  const [repostTargets, setRepostTargets] = useState<RepostTarget[]>([]);
  const [isLoadingRepostTargets, setIsLoadingRepostTargets] = useState(false);
  const [sendingRepostTo, setSendingRepostTo] = useState<string | null>(null);
  const [repostSentTo, setRepostSentTo] = useState<Set<string>>(new Set());

  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [isUploadingStory, setIsUploadingStory] = useState(false);
  const storyFileInputRef = useRef<HTMLInputElement>(null);

  const [viewerGroupIndex, setViewerGroupIndex] = useState<number | null>(null);
  const [viewerStoryIndex, setViewerStoryIndex] = useState(0);
  const [viewerProgress, setViewerProgress] = useState(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

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

  // =========================================================
  // НЕПРОЧИТАННЫЕ СООБЩЕНИЯ
  // =========================================================

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

          if (newMsg.sender_id !== userId && conversationIds.includes(newMsg.conversation_id)) {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // =========================================================
  // ЛАЙКИ
  // =========================================================

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

  // =========================================================
  // 🔔 УВЕДОМЛЕНИЯ
  // =========================================================

  useEffect(() => {
    if (!userId) return;

    const loadNotificationsCount = async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false);

      if (error) {
        console.error("Ошибка загрузки количества уведомлений:", error);
        return;
      }

      setNotificationsCount(count || 0);
    };

    loadNotificationsCount();

    const channel = supabase
      .channel("home_notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          setNotificationsCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // =========================================================
  // STORIES
  // =========================================================

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

    const profilesMap = new Map((profilesData || []).map((p) => [p.id, p]));

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

      const { error: uploadError } = await supabase.storage.from("stories").upload(filePath, file);

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

  // =========================================================
  // POSTS
  // =========================================================

  const fetchPosts = useCallback(async () => {
    setIsLoadingPosts(true);

    try {
      let query = supabase.from("posts").select("*").order("created_at", { ascending: false });

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
        supabase.from("post_likes").select("post_id, user_id, reaction_type").in("post_id", postIds),
        supabase
          .from("post_comments")
          .select("id, post_id, user_id, content, created_at, parent_comment_id, image_url")
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

        if (!commentsMap[c.post_id]) {
          commentsMap[c.post_id] = [];
        }

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

  // =========================================================
  // ВХОД ЧЕРЕЗ TELEGRAM
  // =========================================================
  //
  // Виджет Telegram Login вызывает функцию, указанную в data-onauth,
  // как ГЛОБАЛЬНУЮ (window.onTelegramAuth), а не как переменную React.
  // Поэтому саму функцию мы регистрируем на window в отдельном useEffect
  // ниже. Сама функция шлёт данные на сервер, где:
  //   1) проверяется подлинность подписи Telegram,
  //   2) создаётся/находится пользователь Supabase Auth,
  //   3) выдаётся токен, которым мы логинимся на клиенте через verifyOtp —
  //      после этого supabase.auth.onAuthStateChange сам подхватит нового
  //      пользователя и обновит displayName/userId.

  const onTelegramAuth = useCallback(
    async (tgUser: any) => {
      try {
        const response = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            telegram_id: tgUser.id,
            first_name: tgUser.first_name,
            last_name: tgUser.last_name || "",
            username: tgUser.username || "",
            photo_url: tgUser.photo_url || "",
            auth_date: tgUser.auth_date,
            hash: tgUser.hash,
          }),
        });

        const result = await response.json();

        if (!result.success) {
          console.error("Telegram auth failed:", result.message);
          alert("Не удалось войти через Telegram: " + result.message);
          return;
        }

        const { error: verifyError } = await supabase.auth.verifyOtp({
          email: result.email,
          token: result.token,
          type: "magiclink",
        });

        if (verifyError) {
          console.error("Ошибка подтверждения сессии Telegram:", verifyError);
          alert("Не удалось завершить вход через Telegram");
          return;
        }

        // Сессия установлена — onAuthStateChange сам обновит UI.
      } catch (error) {
        console.error("Ошибка Telegram авторизации:", error);
        alert("Не удалось войти через Telegram");
      }
    },
    [supabase]
  );

  // Регистрируем колбэк глобально ДО того, как виджет Telegram его вызовет
  useEffect(() => {
    (window as any).onTelegramAuth = onTelegramAuth;

    return () => {
      delete (window as any).onTelegramAuth;
    };
  }, [onTelegramAuth]);

  // Кнопку Telegram Login монтируем вручную в конкретный div-контейнер.
  // next/script вставляет тег <script> не строго в место в JSX-дереве
  // (виджет мог "уехать" в конец <body>, из-за чего кнопка не была видна
  // рядом с "Войти"), поэтому создаём и вставляем <script> сами.
  const telegramWidgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoaded || displayName !== "Гость" || !telegramWidgetRef.current) return;

    telegramWidgetRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", "MingleRuBot");
    script.setAttribute("data-size", "medium");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-onauth", "onTelegramAuth");
    script.setAttribute("data-radius", "10");

    telegramWidgetRef.current.appendChild(script);
  }, [isLoaded, displayName]);

  // =========================================================
  // UPLOAD IMAGE
  // =========================================================

  const uploadImageToBucket = async (bucket: string, file: File, folder: string) => {
    const fileExt = file.name.split(".").pop();

    const filePath =
      folder + "/" + Date.now() + "-" + Math.round(Math.random() * 1e6) + "." + fileExt;

    const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file);

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(filePath);

    return publicUrl;
  };

  const handlePostImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setPostImageFile(file);
    setPostImagePreview(URL.createObjectURL(file));
  };

  const handleRemovePostImage = () => {
    setPostImageFile(null);
    setPostImagePreview(null);

    if (postImageInputRef.current) {
      postImageInputRef.current.value = "";
    }
  };

  const handleCommentImageSelect = (postId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setCommentImageFiles((prev) => ({ ...prev, [postId]: file }));
    setCommentImagePreviews((prev) => ({ ...prev, [postId]: URL.createObjectURL(file) }));
  };

  const handleRemoveCommentImage = (postId: string) => {
    setCommentImageFiles((prev) => ({ ...prev, [postId]: null }));

    setCommentImagePreviews((prev) => {
      const next = { ...prev };
      delete next[postId];
      return next;
    });
  };

  // =========================================================
  // POST REACTIONS
  // =========================================================

  const handleReact = async (postId: string, reactionType: string) => {
    if (!userId) {
      router.push("/auth/login");
      return;
    }

    const post = posts.find((p) => p.id === postId);
    const existing = post?.post_likes?.find((l) => l.user_id === userId);
    const isRemoving = existing?.reaction_type === reactionType;

    // Оптимистичное обновление UI
    setPosts((prevPosts) =>
      prevPosts.map((p) => {
        if (p.id !== postId) return p;

        const others = (p.post_likes || []).filter((l) => l.user_id !== userId);
        const updated = isRemoving
          ? others
          : [...others, { user_id: userId, reaction_type: reactionType }];

        return { ...p, post_likes: updated };
      })
    );

    setOpenReactionPickerId(null);

    try {
      if (isRemoving) {
        const { error } = await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId);

        if (error) throw error;
      } else if (existing) {
        const { error } = await supabase
          .from("post_likes")
          .update({ reaction_type: reactionType })
          .eq("post_id", postId)
          .eq("user_id", userId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("post_likes").insert({
          post_id: postId,
          user_id: userId,
          reaction_type: reactionType,
        });

        if (error) throw error;
      }
    } catch (error) {
      console.error("Ошибка обновления реакции:", error);
      fetchPosts();
    }
  };

  // =========================================================
  // CREATE POST
  // =========================================================

  const handleCreatePost = async () => {
    if ((!postText.trim() && !postImageFile) || isSubmitting) {
      return;
    }

    if (!userId) {
      router.push("/auth/login");
      return;
    }

    setIsSubmitting(true);

    let imageUrl: string | null = null;

    if (postImageFile) {
      try {
        imageUrl = await uploadImageToBucket("post-images", postImageFile, userId);
      } catch (err: any) {
        console.error("Ошибка загрузки фото поста:", err);

        alert(
          "Не удалось загрузить фото: " +
            (err?.message || "неизвестная ошибка") +
            '\n\nПроверьте, что в Supabase создан bucket "post-images".'
        );

        setIsSubmitting(false);
        return;
      }
    }

    const { error } = await supabase.from("posts").insert({
      user_id: userId,
      content: postText.trim(),
      category: selectedCategory,
      image_url: imageUrl,
    });

    if (error) {
      console.error("Ошибка при создании поста:", error);
      alert(`Не удалось опубликовать пост: ${error.message}`);
    } else {
      setPostText("");
      handleRemovePostImage();
      await fetchPosts();
    }

    setIsSubmitting(false);
  };

  // =========================================================
  // DELETE POST
  // =========================================================

  const handleDeletePost = async (postId: string) => {
    if (!confirm("Удалить этот пост? Это действие нельзя отменить.")) {
      return;
    }

    const previousPosts = posts;

    setPosts((prev) => prev.filter((p) => p.id !== postId));

    const { data, error } = await supabase.from("posts").delete().eq("id", postId).select();

    if (error) {
      console.error("Ошибка удаления поста:", error);

      alert(
        "Не удалось удалить пост: " +
          error.message +
          (error.code ? " (код: " + error.code + ")" : "")
      );

      setPosts(previousPosts);
      return;
    }

    if (!data || data.length === 0) {
      console.error("Удаление не затронуло ни одной строки — вероятно, RLS блокирует DELETE.");

      alert("Пост не был удалён. Похоже, в Supabase на таблице posts нет DELETE-политики.");

      setPosts(previousPosts);
    }
  };

  // =========================================================
  // COMMENTS
  // =========================================================

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
    const imageFile = commentImageFiles[postId];

    if (!text && !imageFile) return;

    setSubmittingComment((prev) => new Set(prev).add(postId));

    let imageUrl: string | null = null;

    if (imageFile) {
      try {
        imageUrl = await uploadImageToBucket("comment-images", imageFile, userId);
      } catch (err: any) {
        console.error("Ошибка загрузки фото комментария:", err);

        alert("Не удалось загрузить фото: " + (err?.message || "неизвестная ошибка"));

        setSubmittingComment((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });

        return;
      }
    }

    const { data, error } = await supabase
      .from("post_comments")
      .insert({
        post_id: postId,
        user_id: userId,
        content: text,
        parent_comment_id: null,
        image_url: imageUrl,
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
      handleRemoveCommentImage(postId);
    }

    setSubmittingComment((prev) => {
      const next = new Set(prev);
      next.delete(postId);
      return next;
    });
  };

  const startReply = (commentId: string) => {
    setReplyingTo((prev) => ({ ...prev, [commentId]: commentId }));
  };

  const cancelReply = (commentId: string) => {
    setReplyingTo((prev) => ({ ...prev, [commentId]: null }));
    setReplyDrafts((prev) => ({ ...prev, [commentId]: "" }));
  };

  const handleReplyDraftChange = (commentId: string, value: string) => {
    setReplyDrafts((prev) => ({ ...prev, [commentId]: value }));
  };

  const handleAddReply = async (postId: string, parentCommentId: string) => {
    if (!userId) {
      router.push("/auth/login");
      return;
    }

    const text = (replyDrafts[parentCommentId] || "").trim();

    if (!text) return;

    setSubmittingReply((prev) => new Set(prev).add(parentCommentId));

    const { data, error } = await supabase
      .from("post_comments")
      .insert({
        post_id: postId,
        user_id: userId,
        content: text,
        parent_comment_id: parentCommentId,
      })
      .select()
      .single();

    if (error) {
      console.error("Ошибка добавления ответа:", error);
      alert("Не удалось добавить ответ: " + error.message);
    } else if (data) {
      const newReply: Comment = {
        ...data,
        authorName: displayName,
      };

      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newReply],
      }));

      setReplyDrafts((prev) => ({ ...prev, [parentCommentId]: "" }));
      setReplyingTo((prev) => ({ ...prev, [parentCommentId]: null }));
    }

    setSubmittingReply((prev) => {
      const next = new Set(prev);
      next.delete(parentCommentId);
      return next;
    });
  };

  // =========================================================
  // REPOST
  // =========================================================

  const openRepostModal = async (postId: string) => {
    setRepostPostId(postId);
    setRepostSentTo(new Set());

    if (repostTargets.length > 0 || !userId) {
      return;
    }

    setIsLoadingRepostTargets(true);

    const [matches1Res, matches2Res] = await Promise.all([
      supabase.from("matches").select("id, user2_id").eq("user1_id", userId),
      supabase.from("matches").select("id, user1_id").eq("user2_id", userId),
    ]);

    const matchRows = [
      ...(matches1Res.data || []).map((m) => ({ matchId: m.id, otherUserId: m.user2_id })),
      ...(matches2Res.data || []).map((m) => ({ matchId: m.id, otherUserId: m.user1_id })),
    ];

    if (matchRows.length === 0) {
      setRepostTargets([]);
      setIsLoadingRepostTargets(false);
      return;
    }

    const matchIds = matchRows.map((m) => m.matchId);
    const otherUserIds = matchRows.map((m) => m.otherUserId);

    const [conversationsRes, profilesRes] = await Promise.all([
      supabase.from("conversations").select("id, match_id").in("match_id", matchIds),
      supabase.from("profiles").select("id, name, avatar_url, avatar").in("id", otherUserIds),
    ]);

    const targets: RepostTarget[] = matchRows
      .map((row) => {
        const conversation = conversationsRes.data?.find((c) => c.match_id === row.matchId);
        const profile = profilesRes.data?.find((p) => p.id === row.otherUserId);

        if (!conversation || !profile) {
          return null;
        }

        return {
          matchId: row.matchId,
          conversationId: conversation.id,
          name: profile.name || "Пользователь",
          avatar:
            profile.avatar_url ||
            profile.avatar ||
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        } as RepostTarget;
      })
      .filter(Boolean) as RepostTarget[];

    setRepostTargets(targets);
    setIsLoadingRepostTargets(false);
  };

  const closeRepostModal = () => {
    setRepostPostId(null);
  };

  const handleSendRepost = async (target: RepostTarget) => {
    if (!userId || !repostPostId) {
      return;
    }

    const post = posts.find((p) => p.id === repostPostId);

    if (!post) return;

    setSendingRepostTo(target.matchId);

    const excerpt = post.content.length > 120 ? post.content.slice(0, 120) + "..." : post.content;
    const authorName = post.profiles?.name || "Пользователь";

    const messageContent =
      "📤 Поделился(-ась) постом от " + authorName + ':\n"' + excerpt + '"';

    const { error } = await supabase.from("messages").insert({
      conversation_id: target.conversationId,
      sender_id: userId,
      content: messageContent,
    });

    if (error) {
      console.error("Ошибка репоста:", error);
      alert("Не удалось отправить: " + error.message);
    } else {
      setRepostSentTo((prev) => new Set(prev).add(target.matchId));
    }

    setSendingRepostTo(null);
  };

  // =========================================================
  // LOGOUT
  // =========================================================

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (!error) {
      router.push("/auth/login");
      router.refresh();
    }
  };

  if (!isLoaded) return null;

  const activeGroup = viewerGroupIndex !== null ? storyGroups[viewerGroupIndex] : null;
  const activeStory = activeGroup ? activeGroup.stories[viewerStoryIndex] : null;
  const repostPost = repostPostId ? posts.find((p) => p.id === repostPostId) : null;

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-800 font-sans pb-12">
      {/* HEADER */}

      <header className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-logo text-xl text-gray-900">mingle</span>
          <span className="text-xs text-gray-400 font-medium">здесь общаются</span>
        </div>

        <div className="flex items-center gap-3">
          {/* 🔔 УВЕДОМЛЕНИЯ */}
          {userId && (
            <Link
              href="/notifications"
              title="Уведомления"
              className="relative w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition cursor-pointer"
            >
              <span className="text-lg">🔔</span>

              {notificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-pink-600 text-white text-[9px] font-black min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center border-2 border-[#F8F9FA]">
                  {notificationsCount > 9 ? "9+" : notificationsCount}
                </span>
              )}
            </Link>
          )}

          {displayName !== "Гость" ? (
            <>
              <span className="text-xs text-gray-400 hidden sm:inline">
                👋 Здравствуйте,{" "}
                <span className="font-black text-gray-900">{displayName}</span>
              </span>

              <Link
                href="/profile"
                className="flex items-center bg-gray-100 hover:bg-gray-200 rounded-full p-1 text-xs font-bold transition cursor-pointer"
              >
                <span className="bg-pink-500 text-white px-2.5 py-1 rounded-full uppercase text-[10px]">
                  {displayName.slice(0, 2)}
                </span>

                <span className="px-3 text-gray-800 uppercase tracking-wider">{displayName}</span>
              </Link>

              <button
                onClick={handleLogout}
                className="text-xs text-gray-500 hover:text-gray-900 font-medium px-3 py-1.5 rounded-full border border-gray-200 bg-white cursor-pointer"
              >
                Выйти
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              {/* КНОПКА ВХОДА ЧЕРЕЗ TELEGRAM — монтируется вручную через useEffect выше */}
              <div ref={telegramWidgetRef} />

              {/* СТАРАЯ КНОПКА ВХОДА ПО ПОЧТЕ (оставляем на всякий случай) */}
              <Link
                href="/auth/login"
                className="text-xs text-white font-bold px-4 py-2 rounded-full bg-pink-600 hover:bg-pink-700 transition"
              >
                Войти
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* MAIN */}

      <main className="max-w-7xl mx-auto px-6 pt-4 grid grid-cols-12 gap-6">
        {/* ЛЕВОЕ МЕНЮ */}

        <aside className="col-span-12 md:col-span-3 space-y-2">
          <div className="bg-white rounded-3xl p-4 shadow-xs border border-gray-100 space-y-1.5 sticky top-4">
            <Link
              href="/"
              className="flex items-center gap-3.5 px-5 py-3.5 rounded-2xl bg-gray-100 font-bold text-sm text-gray-900"
            >
              🏠 Главная
            </Link>

            <Link
              href="/discover"
              className="flex items-center gap-3.5 px-5 py-3.5 rounded-2xl hover:bg-gray-50 font-bold text-sm text-gray-600 transition"
            >
              🔥 Смотреть людей
            </Link>

            <Link
              href="/matches"
              className="flex items-center gap-3.5 px-5 py-3.5 rounded-2xl hover:bg-gray-50 font-bold text-sm text-gray-600 transition"
            >
              💫 Мэтчи
            </Link>

            <Link
              href="/likes"
              className="flex items-center justify-between px-5 py-3.5 rounded-2xl hover:bg-gray-50 font-bold text-sm text-gray-600 transition"
            >
              <span className="flex items-center gap-3.5">💌 Лайки</span>

              {likesCount > 0 && (
                <span className="bg-pink-600 text-white text-[10px] font-black min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                  {likesCount > 9 ? "9+" : likesCount}
                </span>
              )}
            </Link>

            <Link
              href="/people"
              className="flex items-center gap-3.5 px-5 py-3.5 rounded-2xl hover:bg-gray-50 font-bold text-sm text-gray-600 transition"
            >
              👥 Люди
            </Link>

            <Link
              href="/messages"
              className="flex items-center justify-between px-5 py-3.5 rounded-2xl hover:bg-gray-50 font-bold text-sm text-gray-600 transition"
            >
              <span className="flex items-center gap-3.5">💬 Сообщения</span>

              {unreadCount > 0 && (
                <span className="bg-pink-600 text-white text-[10px] font-black min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>

            <Link
              href="/profile"
              className="flex items-center gap-3.5 px-5 py-3.5 rounded-2xl hover:bg-gray-50 font-bold text-sm text-gray-600 transition"
            >
              👤 Мой профиль
            </Link>
          </div>
        </aside>

        {/* ЦЕНТРАЛЬНАЯ ЛЕНТА */}

        <section className="col-span-12 md:col-span-6 space-y-6">
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
                  {isUploadingStory ? "..." : "+"}
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
                type="button"
                onClick={() => postImageInputRef.current?.click()}
                title="Прикрепить фото"
                className="text-gray-400 hover:text-pink-500 transition cursor-pointer text-lg shrink-0"
              >
                📷
              </button>

              <input
                ref={postImageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePostImageSelect}
              />

              <button
                onClick={handleCreatePost}
                disabled={isSubmitting || (!postText.trim() && !postImageFile)}
                className="bg-[#E02868] hover:bg-pink-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-2xl transition cursor-pointer shrink-0"
              >
                {isSubmitting ? "Публикация..." : "Опубликовать"}
              </button>
            </div>

            {postImagePreview && (
              <div className="relative inline-block">
                <img
                  src={postImagePreview}
                  alt="Превью фото"
                  className="h-20 w-20 object-cover rounded-xl border border-gray-100"
                />

                <button
                  type="button"
                  onClick={handleRemovePostImage}
                  className="absolute -top-2 -right-2 bg-black/70 hover:bg-red-500 text-white w-5 h-5 rounded-full text-[10px] flex items-center justify-center cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

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

          {/* ФИЛЬТРЫ */}

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
                const postReactions = post.post_likes || [];
                const myReaction = postReactions.find((l) => l.user_id === userId)?.reaction_type;
                const totalReactions = postReactions.length;

                // Топ-3 самых частых реакций для сводки на кнопке (как в Facebook)
                const reactionCounts: Record<string, number> = {};
                postReactions.forEach((l) => {
                  const t = l.reaction_type || "like";
                  reactionCounts[t] = (reactionCounts[t] || 0) + 1;
                });
                const topReactionEmojis = Object.entries(reactionCounts)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 3)
                  .map(([type]) => REACTION_OPTIONS.find((r) => r.type === type)?.emoji || "👍");

                const allPostComments = commentsByPost[post.id] || [];
                const topLevelComments = allPostComments.filter((c) => !c.parent_comment_id);
                const isCommentsOpen = openComments.has(post.id);
                const isCommentSubmitting = submittingComment.has(post.id);
                const isOwnPost = post.user_id === userId;

                const getReplies = (commentId: string) =>
                  allPostComments.filter((c) => c.parent_comment_id === commentId);

                return (
                  <div key={post.id} className="bg-white rounded-3xl p-5 shadow-xs border border-gray-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-xs uppercase">
                          {(post.profiles?.name || "П").slice(0, 2)}
                        </div>

                        <div>
                          <h4 className="text-xs font-black text-gray-900">
                            {post.profiles?.name || "Пользователь"}
                          </h4>

                          <span className="text-[10px] text-gray-400">
                            {new Date(post.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-3 py-1 rounded-full">
                          {post.category}
                        </span>

                        {isOwnPost && (
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            title="Удалить пост"
                            className="text-gray-300 hover:text-red-500 transition cursor-pointer text-sm px-1"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>

                    {post.content && (
                      <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {post.content}
                      </p>
                    )}

                    {post.image_url && (
                      <img
                        src={post.image_url}
                        alt=""
                        className="w-full max-h-[420px] object-cover rounded-2xl border border-gray-100"
                      />
                    )}

                    <div className="flex items-center gap-4 text-xs font-medium text-gray-400 pt-2 border-t border-gray-50">
                      <div className="relative">
                        <button
                          onClick={() =>
                            setOpenReactionPickerId((prev) => (prev === post.id ? null : post.id))
                          }
                          className={`flex items-center gap-1.5 transition cursor-pointer font-bold ${
                            myReaction ? "text-pink-600" : "text-gray-500 hover:text-pink-600"
                          }`}
                        >
                          <span className="text-sm">
                            {myReaction
                              ? REACTION_OPTIONS.find((r) => r.type === myReaction)?.emoji
                              : totalReactions > 0
                              ? topReactionEmojis.join("")
                              : "🤍"}
                          </span>
                          <span>{totalReactions}</span>
                        </button>

                        {openReactionPickerId === post.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setOpenReactionPickerId(null)}
                            />
                            <div className="absolute bottom-full left-0 mb-2 bg-white rounded-full shadow-lg border border-gray-100 flex items-center gap-1 px-2 py-1.5 z-20">
                              {REACTION_OPTIONS.map((opt) => (
                                <button
                                  key={opt.type}
                                  onClick={() => handleReact(post.id, opt.type)}
                                  title={opt.type}
                                  className={`text-lg hover:scale-125 transition cursor-pointer ${
                                    myReaction === opt.type ? "scale-125" : ""
                                  }`}
                                >
                                  {opt.emoji}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      <button
                        onClick={() => toggleComments(post.id)}
                        className="flex items-center gap-1 hover:text-gray-600 transition cursor-pointer"
                      >
                        💬 {isCommentsOpen ? "Скрыть" : "Комментировать"}
                        {allPostComments.length > 0 && " (" + allPostComments.length + ")"}
                      </button>

                      <button
                        onClick={() => openRepostModal(post.id)}
                        className="flex items-center gap-1 hover:text-gray-600 transition cursor-pointer"
                      >
                        📤 Отправить в ЛС
                      </button>
                    </div>

                    {isCommentsOpen && (
                      <div className="pt-3 border-t border-gray-50 space-y-3">
                        {topLevelComments.length === 0 ? (
                          <p className="text-[11px] text-gray-400 italic">
                            Пока нет комментариев. Будьте первым!
                          </p>
                        ) : (
                          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                            {topLevelComments.map((comment) => {
                              const replies = getReplies(comment.id);
                              const isReplying = replyingTo[comment.id];
                              const isReplySubmitting = submittingReply.has(comment.id);

                              return (
                                <div key={comment.id} className="space-y-2">
                                  <div className="flex items-start gap-2.5">
                                    <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-600 font-bold flex items-center justify-center text-[10px] uppercase shrink-0">
                                      {comment.authorName.slice(0, 2)}
                                    </div>

                                    <div className="flex-1">
                                      <div className="bg-gray-50 rounded-2xl px-3 py-2">
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

                                        {comment.content && (
                                          <p className="text-[11px] text-gray-700 mt-0.5 whitespace-pre-wrap">
                                            {comment.content}
                                          </p>
                                        )}

                                        {comment.image_url && (
                                          <img
                                            src={comment.image_url}
                                            alt=""
                                            className="mt-1.5 max-h-40 rounded-xl object-cover border border-gray-100"
                                          />
                                        )}
                                      </div>

                                      <button
                                        onClick={() =>
                                          isReplying ? cancelReply(comment.id) : startReply(comment.id)
                                        }
                                        className="text-[10px] text-gray-400 hover:text-pink-500 font-bold mt-1 ml-1 cursor-pointer"
                                      >
                                        {isReplying ? "Отменить" : "Ответить"}
                                      </button>

                                      {replies.length > 0 && (
                                        <div className="mt-2 ml-2 pl-3 border-l-2 border-gray-100 space-y-2">
                                          {replies.map((reply) => (
                                            <div key={reply.id} className="flex items-start gap-2">
                                              <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 font-bold flex items-center justify-center text-[9px] uppercase shrink-0">
                                                {reply.authorName.slice(0, 2)}
                                              </div>

                                              <div className="bg-gray-50 rounded-2xl px-3 py-1.5 flex-1">
                                                <div className="flex items-baseline gap-2">
                                                  <span className="text-[10px] font-bold text-gray-900">
                                                    {reply.authorName}
                                                  </span>

                                                  <span className="text-[9px] text-gray-400">
                                                    {new Date(reply.created_at).toLocaleTimeString([], {
                                                      hour: "2-digit",
                                                      minute: "2-digit",
                                                    })}
                                                  </span>
                                                </div>

                                                <p className="text-[10px] text-gray-700 mt-0.5 whitespace-pre-wrap">
                                                  {reply.content}
                                                </p>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {isReplying && (
                                        <div className="flex items-center gap-2 mt-2 ml-2">
                                          <input
                                            type="text"
                                            value={replyDrafts[comment.id] || ""}
                                            onChange={(e) =>
                                              handleReplyDraftChange(comment.id, e.target.value)
                                            }
                                            onKeyDown={(e) =>
                                              e.key === "Enter" && handleAddReply(post.id, comment.id)
                                            }
                                            placeholder={"Ответить " + comment.authorName + "..."}
                                            className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-3 py-1.5 text-[10px] focus:outline-none focus:border-pink-300"
                                          />

                                          <button
                                            onClick={() => handleAddReply(post.id, comment.id)}
                                            disabled={
                                              isReplySubmitting || !(replyDrafts[comment.id] || "").trim()
                                            }
                                            className="bg-pink-500 hover:bg-pink-600 disabled:opacity-40 text-white text-[10px] font-bold px-3 py-1.5 rounded-2xl transition cursor-pointer shrink-0"
                                          >
                                            {isReplySubmitting ? "..." : "Отправить"}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {commentImagePreviews[post.id] && (
                          <div className="relative inline-block">
                            <img
                              src={commentImagePreviews[post.id]}
                              alt="Превью фото"
                              className="h-16 w-16 object-cover rounded-xl border border-gray-100"
                            />

                            <button
                              type="button"
                              onClick={() => handleRemoveCommentImage(post.id)}
                              className="absolute -top-2 -right-2 bg-black/70 hover:bg-red-500 text-white w-5 h-5 rounded-full text-[10px] flex items-center justify-center cursor-pointer"
                            >
                              ✕
                            </button>
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
                            type="button"
                            onClick={() => document.getElementById("comment-img-" + post.id)?.click()}
                            title="Прикрепить фото"
                            className="text-gray-400 hover:text-pink-500 transition cursor-pointer text-base shrink-0"
                          >
                            📷
                          </button>

                          <input
                            id={"comment-img-" + post.id}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleCommentImageSelect(post.id, e)}
                          />

                          <button
                            onClick={() => handleAddComment(post.id)}
                            disabled={
                              isCommentSubmitting ||
                              (!(commentDrafts[post.id] || "").trim() && !commentImageFiles[post.id])
                            }
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

        {/* ПРАВАЯ КОЛОНКА */}

        <aside className="col-span-12 md:col-span-3 space-y-4">
          <div className="bg-[#B3A1C9] rounded-3xl p-5 text-white shadow-xs sticky top-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black flex items-center gap-1">🤖 AI Помощник</h3>
              <span className="bg-white/30 text-[9px] font-bold px-2 py-0.5 rounded-full">Онлайн</span>
            </div>

            <p className="text-[11px] leading-relaxed opacity-90">
              Помогу оформить профиль и подберу первое сообщение.
            </p>

            <button
              onClick={() => setIsAIModalOpen(true)}
              className="w-full bg-white/30 hover:bg-white/40 text-white font-bold py-2.5 rounded-xl text-xs backdrop-blur-md transition cursor-pointer text-center"
            >
              Открыть AI
            </button>
          </div>
        </aside>
      </main>

      <AIAssistantModal isOpen={isAIModalOpen} onClose={() => setIsAIModalOpen(false)} />

      {/* STORY VIEWER */}

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

                <span className="text-white text-xs font-bold drop-shadow">{activeGroup.name}</span>
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

            <div onClick={goToPrevStory} className="absolute left-0 top-0 bottom-0 w-1/3 cursor-pointer z-20" />
            <div onClick={goToNextStory} className="absolute right-0 top-0 bottom-0 w-1/3 cursor-pointer z-20" />
          </div>
        </div>
      )}

      {/* REPOST MODAL */}

      {repostPostId && repostPost && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={closeRepostModal}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-sm max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-900">Отправить в сообщения</h3>

              <button
                onClick={closeRepostModal}
                className="text-gray-400 hover:text-gray-700 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-gray-50 border-b border-gray-100">
              <p className="text-[11px] text-gray-500 line-clamp-2">{repostPost.content}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {isLoadingRepostTargets ? (
                <p className="text-xs text-gray-400 text-center py-6">Загрузка мэтчей...</p>
              ) : repostTargets.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">
                  Пока нет мэтчей, кому можно отправить
                </p>
              ) : (
                repostTargets.map((target) => {
                  const isSent = repostSentTo.has(target.matchId);
                  const isSending = sendingRepostTo === target.matchId;

                  return (
                    <div
                      key={target.matchId}
                      className="flex items-center justify-between gap-3 p-2 rounded-2xl hover:bg-gray-50 transition"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={target.avatar}
                          alt={target.name}
                          className="w-9 h-9 rounded-full object-cover"
                        />

                        <span className="text-xs font-bold text-gray-900">{target.name}</span>
                      </div>

                      <button
                        onClick={() => handleSendRepost(target)}
                        disabled={isSending || isSent}
                        className={`text-[11px] font-bold px-3 py-1.5 rounded-xl transition cursor-pointer ${
                          isSent
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-pink-500 hover:bg-pink-600 text-white disabled:opacity-50"
                        }`}
                      >
                        {isSent ? "Отправлено ✓" : isSending ? "..." : "Отправить"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

