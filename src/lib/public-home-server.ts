import "server-only";
import { demoData } from "@/lib/demo-data";
import { emptyLandingCounts, type LandingCounts } from "@/lib/landing-stats";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { LandingContent } from "@/lib/types";

const fallbackLanding: LandingContent = {
  ...demoData.landingContent,
  eventImages: [],
  teamImage: "",
  teamNames: [],
  impressions: []
};

export async function loadPublicHomeData(): Promise<{ counts: LandingCounts; landing: LandingContent }> {
  if (!supabaseAdmin) {
    return { counts: emptyLandingCounts, landing: fallbackLanding };
  }

  const [landingResult, eventsResult, techniciansResult, equipmentResult] = await Promise.all([
    supabaseAdmin
      .from("landing_content")
      .select("hero_title, hero_text, join_title, join_text, event_images, team_image, team_names, impressions, content_settings")
      .maybeSingle(),
    supabaseAdmin.from("events").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("equipment_items").select("id", { count: "exact", head: true })
  ]);

  const row = landingResult.data;
  const settings = isRecord(row?.content_settings) ? row.content_settings : {};
  const rawStats = Array.isArray(settings.stats) ? settings.stats : fallbackLanding.stats;
  const landing: LandingContent = row
    ? {
        ...fallbackLanding,
        ...settings,
        heroTitle: row.hero_title,
        heroText: row.hero_text,
        joinTitle: row.join_title,
        joinText: row.join_text,
        eventImages: stringArray(row.event_images),
        teamImage: typeof row.team_image === "string" ? row.team_image : "",
        teamNames: stringArray(row.team_names),
        impressions: Array.isArray(row.impressions) ? row.impressions : [],
        stats: rawStats.map(normalizeStat).filter((stat): stat is LandingContent["stats"][number] => Boolean(stat))
      }
    : fallbackLanding;

  return {
    counts: {
      events: eventsResult.count ?? 0,
      technicians: techniciansResult.count ?? 0,
      equipment: equipmentResult.count ?? 0
    },
    landing
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeStat(value: unknown): LandingContent["stats"][number] | null {
  if (!isRecord(value) || !["events", "lamps", "technicians", "equipment"].includes(String(value.id))) {
    return null;
  }
  return {
    id: value.id as LandingContent["stats"][number]["id"],
    label: typeof value.label === "string" ? value.label : "",
    suffix: typeof value.suffix === "string" ? value.suffix : "",
    manualValue: value.id === "lamps" && Number.isFinite(Number(value.manualValue)) ? Math.max(0, Math.round(Number(value.manualValue))) : undefined
  };
}
