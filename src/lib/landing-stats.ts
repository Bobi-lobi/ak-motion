export type LandingCounts = {
  events: number;
  technicians: number;
  equipment: number;
};

export const emptyLandingCounts: LandingCounts = {
  events: 0,
  technicians: 0,
  equipment: 0
};

export async function loadLandingCounts(): Promise<LandingCounts> {
  const response = await fetch("/api/public-stats", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Startseiten-Zähler konnten nicht geladen werden.");
  }
  return response.json() as Promise<LandingCounts>;
}
