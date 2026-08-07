import { createClient } from "@/lib/supabase/client";

export async function getProfiles() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .neq("id", user.id)
    .eq("is_public", true);

  if (error) {
    console.error(error);
    return [];
  }

  return data;
}