// Возвращает множество ID пользователей, которых нужно скрыть:
// как тех, кого заблокировал текущий пользователь (в любую сторону —
// если заблокировали вас, вы тоже не видите этого человека), так и тех,
// кого забанил администратор через /admin/reports.
export async function fetchBlockedUserIds(
  supabase: any,
  userId: string
): Promise<Set<string>> {
  const [blockedByMe, blockedMe, bannedUsers] = await Promise.all([
    supabase.from("blocks").select("blocked_id").eq("blocker_id", userId),
    supabase.from("blocks").select("blocker_id").eq("blocked_id", userId),
    supabase.from("profiles").select("id").eq("is_banned", true),
  ]);

  const ids = new Set<string>();

  (blockedByMe.data || []).forEach((b: { blocked_id: string }) => ids.add(b.blocked_id));
  (blockedMe.data || []).forEach((b: { blocker_id: string }) => ids.add(b.blocker_id));
  (bannedUsers.data || []).forEach((p: { id: string }) => ids.add(p.id));

  return ids;
}