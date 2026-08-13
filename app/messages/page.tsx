"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Profile {
  id: string;
  name: string;
  avatar_url?: string;
  avatar?: string;
  last_seen?: string;
}

interface MatchInfo {
  profile: Profile;
  matchId: string;
  conversationId: string;
  unreadCount: number;
  isNew: boolean;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

export default function MessagesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getAvatar = (p?: Profile) => {
    if (!p) return "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500";
    return p.avatar_url || p.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500";
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase.channel("online-users");

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const activeIds = Object.values(state)
          .flat()
          .map((p: any) => p.user_id);
        setOnlineUserIds(activeIds);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: currentUserId,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const loadMatchesWithCounts = async (currentId: string) => {
    const { data: matches1 } = await supabase
      .from("matches")
      .select("id, user2_id")
      .eq("user1_id", currentId);

    const { data: matches2 } = await supabase
      .from("matches")
      .select("id, user1_id")
      .eq("user2_id", currentId);

    const matchRows = [
      ...(matches1 || []).map((m) => ({ matchId: m.id, otherUserId: m.user2_id })),
      ...(matches2 || []).map((m) => ({ matchId: m.id, otherUserId: m.user1_id })),
    ];

    if (matchRows.length === 0) {
      setMatches([]);
      return [];
    }

    const matchIds = matchRows.map((m) => m.matchId);
    const otherUserIds = matchRows.map((m) => m.otherUserId);

    const { data: conversations } = await supabase
      .from("conversations")
      .select("id, match_id")
      .in("match_id", matchIds);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", otherUserIds);

    const conversationIds = conversations?.map((c) => c.id) || [];

    const { data: unreadMessages } = await supabase
      .from("messages")
      .select("conversation_id, sender_id, is_read")
      .in("conversation_id", conversationIds.length > 0 ? conversationIds : ["00000000-0000-0000-0000-000000000000"]);

    const combined: MatchInfo[] = matchRows
      .map((row) => {
        const conversation = conversations?.find((c) => c.match_id === row.matchId);
        const profile = profiles?.find((p) => p.id === row.otherUserId);

        if (!conversation || !profile) return null;

        const msgsInConv = unreadMessages?.filter((m) => m.conversation_id === conversation.id) || [];
        const unreadCount = msgsInConv.filter((m) => !m.is_read && m.sender_id !== currentId).length;
        const isNew = msgsInConv.length === 0;

        return {
          profile,
          matchId: row.matchId,
          conversationId: conversation.id,
          unreadCount,
          isNew,
        };
      })
      .filter((m): m is MatchInfo => m !== null);

    setMatches(combined);
    return combined;
  };

  useEffect(() => {
    const init = async () => {
      setIsLoadingMatches(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
        return;
      }

      setCurrentUserId(user.id);
      const combined = await loadMatchesWithCounts(user.id);

      if (combined && combined.length > 0) {
        setSelectedMatch(combined[0]);
      }

      setIsLoadingMatches(false);
    };

    init();
  }, []);

  const markAsRead = async (conversationId: string, currentId: string) => {
    await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("conversation_id", conversationId)
      .eq("is_read", false)
      .neq("sender_id", currentId);

    setMatches((prev) =>
      prev.map((m) =>
        m.conversationId === conversationId ? { ...m, unreadCount: 0, isNew: false } : m
      )
    );

    setMessages((prev) =>
      prev.map((m) => (m.sender_id !== currentId ? { ...m, is_read: true } : m))
    );
  };

  const handleSelectMatch = (match: MatchInfo) => {
    setSelectedMatch(match);
    if (currentUserId && match.unreadCount > 0) {
      markAsRead(match.conversationId, currentUserId);
    }
  };

  useEffect(() => {
    if (!currentUserId || !selectedMatch) return;

    const conversationId = selectedMatch.conversationId;

    const loadMessages = async () => {
      setIsLoadingMessages(true);
      setSendError(null);

      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Ошибка при загрузке сообщений:", error);
      } else {
        setMessages(data || []);
      }

      setIsLoadingMessages(false);

      if (selectedMatch.unreadCount > 0) {
        markAsRead(conversationId, currentUserId);
      }
    };

    loadMessages();

    const channel = supabase
      .channel(`chat_${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          if (newMsg.sender_id !== currentUserId) {
            markAsRead(conversationId, currentUserId);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updatedMsg = payload.new as Message;
          setMessages((prev) =>
            prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, selectedMatch?.conversationId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendError(null);

    if (!newMessage.trim() || !currentUserId || !selectedMatch) return;

    const textToSend = newMessage.trim();
    setNewMessage("");

    const tempId = Math.random().toString();
    const tempMsg: Message = {
      id: tempId,
      conversation_id: selectedMatch.conversationId,
      sender_id: currentUserId,
      content: textToSend,
      created_at: new Date().toISOString(),
      is_read: false,
    };

    setMessages((prev) => [...prev, tempMsg]);

    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: selectedMatch.conversationId,
        sender_id: currentUserId,
        content: textToSend,
      })
      .select()
      .single();

    if (error) {
      console.error("Ошибка отправки сообщения:", error);
      setSendError(`Ошибка: ${error.message}`);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } else if (data) {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? data : m)));

      setMatches((prev) =>
        prev.map((m) =>
          m.conversationId === selectedMatch.conversationId ? { ...m, isNew: false } : m
        )
      );
    }
  };

  const formatLastSeen = (dateString?: string) => {
    if (!dateString) return "Был(а) недавно";
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

    if (diffMinutes < 5) return "Был(а) только что";
    if (diffMinutes < 60) return `Был(а) ${diffMinutes} мин. назад`;
    return `Был(а) в ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  const isSelectedUserOnline = selectedMatch
    ? onlineUserIds.includes(selectedMatch.profile.id)
    : false;

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-800 flex flex-col justify-between pb-4 select-none">
      <header className="w-full px-6 h-16 flex items-center justify-between border-b border-gray-100 bg-white shadow-sm">
        <Link href="/discover" className="text-xs font-bold text-gray-500 hover:text-gray-900 transition">
          ← К анкетам
        </Link>
        <span className="text-sm font-black tracking-wider text-gray-900">MESSAGES</span>
        <Link href="/profile" className="text-xs font-bold text-gray-500 hover:text-gray-900 transition">
          Профиль
        </Link>
      </header>

      <main className="w-full max-w-6xl mx-auto flex-1 flex flex-col bg-white overflow-hidden my-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            Взаимные мэтчи ({matches.length})
          </h3>

          {isLoadingMatches ? (
            <div className="text-xs text-gray-400 animate-pulse">Загрузка мэтчей...</div>
          ) : matches.length === 0 ? (
            <p className="text-xs text-gray-400 italic">
              Пока нет мэтчей. Перейдите в /discover и свайпните вправо!
            </p>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
              {matches.map((match) => {
                const isSelected = selectedMatch?.matchId === match.matchId;
                const isOnline = onlineUserIds.includes(match.profile.id);

                return (
                  <button
                    key={match.matchId}
                    onClick={() => handleSelectMatch(match)}
                    className="flex flex-col items-center gap-1 min-w-[60px] cursor-pointer relative"
                  >
                    <div className="relative">
                      <div
                        className={`w-14 h-14 rounded-full p-0.5 transition ${
                          isSelected
                            ? "ring-2 ring-pink-500 ring-offset-2 scale-105"
                            : "opacity-80 hover:opacity-100"
                        }`}
                      >
                        <img
                          src={getAvatar(match.profile)}
                          alt={match.profile.name}
                          className="w-full h-full object-cover rounded-full"
                        />
                      </div>

                      {isOnline && (
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white" />
                      )}

                      {match.unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-pink-600 text-white text-[9px] font-black min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center border-2 border-white">
                          {match.unreadCount > 9 ? "9+" : match.unreadCount}
                        </span>
                      )}

                      {match.isNew && match.unreadCount === 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white" />
                      )}
                    </div>

                    <span
                      className={`text-[11px] truncate max-w-[60px] ${
                        isSelected ? "font-bold text-pink-600" : "text-gray-600"
                      }`}
                    >
                      {match.profile.name || "Анкета"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {!selectedMatch ? (
          <div className="flex-1 flex items-center justify-center p-6 text-center text-xs text-gray-400 min-h-[300px]">
            Выберите мэтч сверху, чтобы открыть чат
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-between overflow-hidden min-h-[400px]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3 bg-white">
              <div className="relative">
                <img
                  src={getAvatar(selectedMatch.profile)}
                  alt={selectedMatch.profile.name}
                  className="w-10 h-10 object-cover rounded-full"
                />
                <span
                  className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                    isSelectedUserOnline ? "bg-green-500" : "bg-gray-300"
                  }`}
                />
              </div>

              <div>
                <h4 className="text-sm font-bold text-gray-900">{selectedMatch.profile.name}</h4>
                <span
                  className={`text-xs font-medium ${
                    isSelectedUserOnline ? "text-green-500" : "text-gray-400"
                  }`}
                >
                  {isSelectedUserOnline
                    ? "● В сети"
                    : formatLastSeen(selectedMatch.profile.last_seen)}
                </span>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-[#F8F9FA]/50">
              {sendError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs p-3 rounded-xl text-center">
                  {sendError}
                </div>
              )}

              {isLoadingMessages ? (
                <div className="text-center text-xs text-gray-400 animate-pulse py-4">
                  Загружаем историю сообщений...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-xs text-gray-400 py-12">
                  Начните диалог первым 👋
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.sender_id === currentUserId;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`max-w-[65%] px-4 py-3 rounded-2xl text-xs leading-relaxed ${
                          isMe
                            ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-br-none shadow-sm"
                            : "bg-white border border-gray-100 text-gray-800 rounded-bl-none shadow-sm"
                        }`}
                      >
                        {msg.content}
                      </div>

                      <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-1 px-1">
                        <span>
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>

                        {isMe && (
                          <span className="font-bold text-[11px]">
                            {msg.is_read ? (
                              <span className="text-pink-500" title="Прочитано">
                                ✓✓
                              </span>
                            ) : (
                              <span className="text-gray-300" title="Отправлено">
                                ✓
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <form
              onSubmit={handleSendMessage}
              className="p-4 border-t border-gray-100 bg-white flex items-center gap-3"
            >
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={`Сообщение для ${selectedMatch.profile.name}...`}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-5 py-3 text-xs text-gray-900 focus:outline-none focus:border-pink-500 transition"
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="bg-pink-500 hover:bg-pink-600 disabled:opacity-40 text-white font-bold px-6 py-3 rounded-2xl text-xs transition cursor-pointer"
              >
                Отправить
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}