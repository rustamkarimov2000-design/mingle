// Возвращает множество ID пользователей, которых нужно скрыть:
// как тех, кого заблокировал текущий пользователь, так и тех,
// кто заблокировал текущего пользователя (блокировка взаимная —
// если заблокировали вас, вы тоже не видите этого человека).
export async function fetchBlockedUserIds(
  supabase: any,
  userId: string
): Promise<Set<string>> {
  const [blockedByMe, blockedMe] = await Promise.all([
    supabase.from("blocks").select("blocked_id").eq("blocker_id", userId),
    supabase.from("blocks").select("blocker_id").eq("blocked_id", userId),
  ]);

  const ids = new Set<string>();

  (blockedByMe.data || []).forEach((b: { blocked_id: string }) => ids.add(b.blocked_id));
  (blockedMe.data || []).forEach((b: { blocker_id: string }) => ids.add(b.blocker_id));

  return ids;
}