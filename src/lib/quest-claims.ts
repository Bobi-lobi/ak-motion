import { supabase } from "@/lib/supabase";
import type { XpAward } from "@/lib/types";

export async function saveQuestClaims(questIds: string[]): Promise<XpAward[]> {
  if (!supabase) throw new Error("Zum Abholen von Quest-XP wird eine Datenbankverbindung benötigt.");
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Bitte melde dich erneut an.");
  const response = await fetch("/api/quests/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify({ questIds })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Quest-XP konnten nicht gespeichert werden.");
  return result.awards;
}
