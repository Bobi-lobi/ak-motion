import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { calculatePlayerScores, questDefinitions } from "@/lib/gamification";
import { requireUserFromRequest, supabaseAdmin } from "@/lib/supabase-admin";
import type { AssignmentRole, Event, EventAssignment, EventAttendance, EventPreparationRating, Profile, XpAward } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    const { questIds } = await request.json();
    if (!Array.isArray(questIds) || !questIds.length || questIds.length > questDefinitions.length || questIds.some((id) => typeof id !== "string" || !questDefinitions.some((quest) => quest.id === id))) {
      return NextResponse.json({ error: "Ungültige Quest-Auswahl." }, { status: 400 });
    }
    const db = supabaseAdmin!;
    const [profile, events, assignments, attendance, awards, ratings] = await Promise.all([
      db.from("profiles").select("id, name, email, role, created_at").eq("id", user.id).single(),
      db.from("events").select("id, title, starts_at, ends_at, event_type, status, created_at"),
      db.from("event_assignments").select("id, event_id, profile_id, role, created_at").eq("profile_id", user.id),
      db.from("event_attendance").select("id, event_id, profile_id, role, attended, created_at").eq("profile_id", user.id),
      db.from("xp_awards").select("id, profile_id, amount, reason, created_by, created_at").eq("profile_id", user.id),
      db.from("event_preparation_ratings").select("id, event_id, rated_by, stars, created_at, updated_at")
    ]);
    for (const result of [profile, events, assignments, attendance, awards, ratings]) if (result.error) throw result.error;
    const person: Profile = { id: profile.data!.id, name: profile.data!.name, email: profile.data!.email, role: profile.data!.role, createdAt: profile.data!.created_at };
    const calendar: Event[] = (events.data ?? []).map((event) => ({ id: event.id, title: event.title, startsAt: event.starts_at, endsAt: event.ends_at, eventType: event.event_type, status: event.status, createdAt: event.created_at, location: "", notes: "", techNeeds: "" }));
    const roles: EventAssignment[] = (assignments.data ?? []).map((item) => ({ id: item.id, eventId: item.event_id, profileId: item.profile_id, role: item.role as AssignmentRole, createdAt: item.created_at }));
    const attended: EventAttendance[] = (attendance.data ?? []).map((item) => ({ id: item.id, eventId: item.event_id, profileId: item.profile_id, role: item.role as AssignmentRole, attended: item.attended, createdAt: item.created_at }));
    const preparation: EventPreparationRating[] = (ratings.data ?? []).map((item) => ({ id: item.id, eventId: item.event_id, ratedBy: item.rated_by, stars: item.stars, createdAt: item.created_at, updatedAt: item.updated_at }));
    const saved: XpAward[] = (awards.data ?? []).map(mapAward);
    // Validate legacy browser claims as well as new claims against database facts.
    // Deterministic IDs make simultaneous/repeated submissions idempotent.
    for (const quest of questDefinitions) {
      if (!questIds.includes(quest.id) || saved.some((award) => award.reason === `quest:${quest.id}`)) continue;
      const score = calculatePlayerScores([person], calendar, roles, attended, {}, saved, preparation)[0];
      const eligible = score?.activeQuests.find((item) => item.id === quest.id);
      if (!eligible || eligible.current < eligible.goal) continue;
      const hash = createHash("sha256").update(`motion-quest:${user.id}:${quest.id}`).digest("hex");
      const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
      const award = { id, profile_id: user.id, amount: quest.bonusXp, reason: `quest:${quest.id}`, created_by: user.id, created_at: new Date().toISOString() };
      const { error } = await db.from("xp_awards").insert(award);
      if (error && error.code !== "23505") throw error;
      saved.push(mapAward(award));
    }
    return NextResponse.json({ awards: saved });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Quest-Abholung fehlgeschlagen:", error);
    return NextResponse.json({ error: "Quest-XP konnten nicht gespeichert werden. Bitte die Migration 20261029140000_shared_quest_xp.sql auf dem NAS prüfen." }, { status: 503 });
  }
}

function mapAward(award: { id: string; profile_id: string; amount: number; reason: string; created_by: string | null; created_at: string }): XpAward {
  return { id: award.id, profileId: award.profile_id, amount: award.amount, reason: award.reason, createdBy: award.created_by ?? undefined, createdAt: award.created_at };
}
