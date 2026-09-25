import type { AssignmentRole, Event as CalendarEvent, EventAssignment, EventAttendance, EventPreparationRating, Profile, XpAward } from "@/lib/types";

export const rankLadder = [
  { name: "Kevin", min: 0 },
  { name: "Kabelwickler", min: 120 },
  { name: "Mini-Techniker", min: 300 },
  { name: "Techniker", min: 650 },
  { name: "Technikleitung", min: 2100 },
  { name: "Technik-Profi", min: 3800 },
  { name: "Technik-Legende", min: 7500 },
  { name: "Unantastbar", min: 60000 },
  { name: "Kabel-Kobold", min: 75000 },
  { name: "Pult-Pilot", min: 90000 },
  { name: "Signalzauberer", min: 110000 },
  { name: "Bühnenboss", min: 135000 },
  { name: "Frequenz-Fürst", min: 165000 },
  { name: "Lichtgott", min: 200000 },
  { name: "Technik-Titan", min: 250000 }
];

export const roleXp: Record<AssignmentRole, number> = {
  Ton: 50,
  Licht: 50,
  Umbau: 50,
  Angel: 25,
  Kleine: 20,
  Teilnehmer: 0
};

export const eventTypeXpLimits = [
  { type: "Schulische Veranstaltung", xp: 40 },
  { type: "Probe", xp: 30 },
  { type: "Feier", xp: 150 },
  { type: "Vortrag", xp: 100 },
  { type: "Aufführung", xp: 200 },
  { type: "Konzert", xp: 300 },
  { type: "Vorbereiten", xp: 100 },
  { type: "Termin", xp: 0 }
];

const allAssignmentRoles: AssignmentRole[] = ["Ton", "Licht", "Angel", "Umbau", "Kleine"];

export type QuestMetric = "events" | "afterSchool" | "baseXp" | "roles";

export type QuestDefinition = {
  bonusXp: number;
  description: string;
  goal: number;
  id: string;
  metric: QuestMetric;
  title: string;
  unit: string;
};

export type QuestProgress = QuestDefinition & {
  current: number;
  progress: number;
};

export type CompletedQuest = QuestProgress & {
  completedAtLabel: string;
};

export type PlayerScore = {
  activeQuests: QuestProgress[];
  attendedCount: number;
  badges: string[];
  basePoints: number;
  completedQuests: CompletedQuest[];
  completedEvents: number;
  level: number;
  nextProgress: number;
  nextRank?: (typeof rankLadder)[number];
  points: number;
  profile: Profile;
  questBonus: number;
  rank: string;
  realEvents: number;
  rehearsals: number;
  roleCount: number;
};

export const questDefinitions = [
  {
    id: "after-school-2",
    metric: "afterSchool",
    title: "Nachmittags-Crew",
    description: "Übernimm zwei Einsätze, die nach 14:00 Uhr starten.",
    goal: 2,
    unit: "Einsätze",
    bonusXp: 45
  },
  {
    id: "xp-600",
    metric: "baseXp",
    title: "600 Basis-XP",
    description: "Sammle 600 XP nur aus Veranstaltungen, ohne Questbonus.",
    goal: 600,
    unit: "XP",
    bonusXp: 75
  },
  {
    id: "events-8",
    metric: "events",
    title: "Acht Einsätze",
    description: "Betreue acht abgeschlossene Veranstaltungen.",
    goal: 8,
    unit: "Einsätze",
    bonusXp: 90
  },
  {
    id: "after-school-6",
    metric: "afterSchool",
    title: "Sechs After-School-Shows",
    description: "Übernimm sechs Einsätze nach 14:00 Uhr.",
    goal: 6,
    unit: "Einsätze",
    bonusXp: 110
  },
  {
    id: "xp-1700",
    metric: "baseXp",
    title: "1.700 Basis-XP",
    description: "Sammle 1.700 XP nur aus Veranstaltungen.",
    goal: 1700,
    unit: "XP",
    bonusXp: 150
  },
  {
    id: "events-18",
    metric: "events",
    title: "18 Einsätze",
    description: "Betreue 18 abgeschlossene Veranstaltungen.",
    goal: 18,
    unit: "Einsätze",
    bonusXp: 220
  },
  {
    id: "roles-4",
    metric: "roles",
    title: "Vier Rollen meistern",
    description: "Werde in vier unterschiedlichen Rollen eingeteilt.",
    goal: 4,
    unit: "Rollen",
    bonusXp: 240
  },
  {
    id: "xp-3800",
    metric: "baseXp",
    title: "3.800 Basis-XP",
    description: "Sammle 3.800 XP nur aus Veranstaltungen.",
    goal: 3800,
    unit: "XP",
    bonusXp: 360
  },
  {
    id: "events-35",
    metric: "events",
    title: "35 Einsätze",
    description: "Betreue 35 abgeschlossene Veranstaltungen.",
    goal: 35,
    unit: "Einsätze",
    bonusXp: 520
  },
  {
    id: "after-school-28",
    metric: "afterSchool",
    title: "28 lange Tage",
    description: "Übernimm 28 Einsätze nach 14:00 Uhr.",
    goal: 28,
    unit: "Einsätze",
    bonusXp: 620
  },
  {
    id: "xp-8500",
    metric: "baseXp",
    title: "8.500 Basis-XP",
    description: "Sammle 8.500 XP nur aus Veranstaltungen.",
    goal: 8500,
    unit: "XP",
    bonusXp: 900
  },
  {
    id: "events-70",
    metric: "events",
    title: "70 Einsätze",
    description: "Betreue 70 abgeschlossene Veranstaltungen.",
    goal: 70,
    unit: "Einsätze",
    bonusXp: 1300
  },
  {
    id: "xp-18000",
    metric: "baseXp",
    title: "18.000 Basis-XP",
    description: "Sammle 18.000 XP nur aus Veranstaltungen.",
    goal: 18000,
    unit: "XP",
    bonusXp: 2200
  }
] satisfies QuestDefinition[];

export function eventMaxXp(event: CalendarEvent) {
  const typeLimit = eventTypeXpLimit(event);
  if (typeLimit !== null) {
    return typeLimit + durationXp(event);
  }
  const bestRoleXp = Math.max(...Object.values(roleXp));
  return eventBaseXp(event) + durationXp(event) + afterSchoolXp(event) + bestRoleXp + 20;
}

export function assignmentXp(event: CalendarEvent, role: AssignmentRole, attended: boolean, preparationXp = 0) {
  if (isEventType(event, "Termin") || role === "Teilnehmer") {
    return isEventType(event, "Vorbereiten") ? Math.min(100, Math.max(0, preparationXp)) : 0;
  }
  const rawXp = eventBaseXp(event) + afterSchoolXp(event) + roleXp[role] + (attended ? 20 : 0);
  const durationBonus = durationXp(event);
  const typeLimit = eventTypeXpLimit(event);
  return (typeLimit === null ? rawXp : Math.min(typeLimit, rawXp)) + durationBonus;
}

export function eventBaseXp(event: CalendarEvent) {
  if (isEventType(event, "Schulische Veranstaltung")) {
    return 20;
  }
  if (isRehearsal(event)) {
    return 15;
  }
  return 70;
}

export function durationXp(event: CalendarEvent) {
  const durationHours = Math.max(0, (new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime()) / 3_600_000);
  return Math.round(durationHours * 28);
}

export function afterSchoolXp(event: CalendarEvent) {
  return new Date(event.startsAt).getHours() >= 14 ? 35 : 0;
}

export function isRehearsal(event: CalendarEvent) {
  return isEventType(event, "Probe");
}

export function assignmentRolesForEventType(eventType: string): AssignmentRole[] {
  if (["Termin", "Vorbereiten"].some((type) => normalizeEventType(eventType) === normalizeEventType(type))) {
    return ["Teilnehmer"];
  }
  return normalizeEventType(eventType) === normalizeEventType("Schulische Veranstaltung") ? ["Ton"] : allAssignmentRoles;
}

export function eventTypeXpLimit(event: CalendarEvent) {
  const match = eventTypeXpLimits.find((item) => normalizeEventType(item.type) === normalizeEventType(event.eventType));
  return match?.xp ?? null;
}

export function calculatePlayerScores(
  profiles: Profile[],
  events: CalendarEvent[],
  assignments: EventAssignment[],
  attendance: EventAttendance[],
  claimedQuestIdsByProfile: Record<string, string[]> = {},
  xpAwards: XpAward[] = [],
  preparationRatings: EventPreparationRating[] = []
) {
  const eventById = new Map(events.map((event) => [event.id, event]));
  const activeProfiles = profiles.filter(
    (profile) => (profile.role === "technician" || profile.role === "admin") && !isPlaceholderProfile(profile)
  );

  return activeProfiles
    .map<PlayerScore>((profile) => {
      const playerAssignments = assignments.filter((assignment) => assignment.profileId === profile.id);
      let basePoints = 0;
      let attendedCount = 0;
      const completedEventIds = new Set<string>();
      const afterSchoolEventIds = new Set<string>();
      const realEventIds = new Set<string>();
      const rehearsalEventIds = new Set<string>();
      const roles = new Set<AssignmentRole>();

      playerAssignments.forEach((assignment) => {
        const event = eventById.get(assignment.eventId);
        if (
          !event ||
          isEventType(event, "Termin") ||
          event.status !== "Abgeschlossen"
        ) {
          return;
        }

        const attended = attendance.some(
          (entry) =>
            entry.eventId === assignment.eventId &&
            entry.profileId === profile.id &&
            entry.role === assignment.role &&
            entry.attended
        );
        const eventRatings = preparationRatings.filter((rating) => rating.eventId === event.id);
        const preparationXp = eventRatings.length
          ? Math.round((eventRatings.reduce((sum, rating) => sum + rating.stars, 0) / eventRatings.length) * 20)
          : 0;
        const points = assignmentXp(event, assignment.role, attended, preparationXp);

        basePoints += points;
        if (attended) {
          attendedCount += 1;
        }
        if (isEventType(event, "Vorbereiten")) {
          return;
        }
        if (assignmentRolesForEventType(event.eventType).includes(assignment.role)) {
          roles.add(assignment.role);
        }
        completedEventIds.add(event.id);
        if (afterSchoolXp(event) > 0) {
          afterSchoolEventIds.add(event.id);
        }
        if (isRehearsal(event)) {
          rehearsalEventIds.add(event.id);
        } else {
          realEventIds.add(event.id);
        }
      });

      basePoints += xpAwards
        .filter((award) => award.profileId === profile.id)
        .reduce((sum, award) => sum + award.amount, 0);

      const questResult = createQuestProgress({
        afterSchool: afterSchoolEventIds.size,
        baseXp: basePoints,
        events: completedEventIds.size,
        roles: roles.size
      }, claimedQuestIdsByProfile[profile.id] ?? []);
      const points = basePoints + questResult.questBonus;
      const rank = getRank(points);
      const nextRank = rankLadder.find((item) => item.min > points);
      const previousRank = [...rankLadder].reverse().find((item) => item.min <= points) ?? rankLadder[0];
      const nextProgress = nextRank
        ? Math.min(100, Math.round(((points - previousRank.min) / (nextRank.min - previousRank.min)) * 100))
        : 100;
      const badges = [
        realEventIds.size >= 3 ? "Zertifikat" : "",
        roles.size >= 3 ? "Allrounder" : "",
        points >= 1150 ? "Captain" : "",
        questResult.completedQuests.length ? "Quest-Serie" : ""
      ].filter(Boolean);

      return {
        profile,
        points,
        basePoints,
        questBonus: questResult.questBonus,
        level: Math.floor(points / 120) + 1,
        rank,
        nextRank,
        nextProgress,
        completedEvents: completedEventIds.size,
        realEvents: realEventIds.size,
        rehearsals: rehearsalEventIds.size,
        roleCount: roles.size,
        attendedCount,
        activeQuests: questResult.activeQuests,
        completedQuests: questResult.completedQuests,
        badges
      };
    })
    .sort((a, b) => b.points - a.points || b.completedEvents - a.completedEvents || a.profile.name.localeCompare(b.profile.name));
}

export function createQuestProgress(stats: Record<QuestMetric, number>, claimedQuestIds: string[] = []) {
  let questBonus = 0;
  const completedQuests: CompletedQuest[] = [];
  const activeQuests: QuestProgress[] = [];
  const claimed = new Set(claimedQuestIds);

  for (const quest of questDefinitions) {
    const current = stats[quest.metric] ?? 0;
    const questProgress = {
      ...quest,
      current,
      progress: progress(current, quest.goal)
    };
    const completed = current >= quest.goal;
    const isClaimed = claimed.has(quest.id);

    if (completed && isClaimed) {
      questBonus += quest.bonusXp;
      completedQuests.push({
        ...questProgress,
        completedAtLabel: "Quest abgeschlossen"
      });
      continue;
    }

    if (activeQuests.length < 3) {
      activeQuests.push(questProgress);
    }
  }

  return {
    activeQuests,
    completedQuests,
    questBonus
  };
}

export function isPlaceholderProfile(profile: Pick<Profile, "name" | "email">) {
  const normalized = `${profile.name} ${profile.email}`.trim().toLowerCase();
  return (
    normalized.includes("nicht gebraucht") ||
    normalized.includes("niemand gebraucht") ||
    normalized.includes("keiner gebraucht") ||
    normalized.includes("kein techniker")
  );
}

export function getRank(points: number) {
  return [...rankLadder].reverse().find((rank) => points >= rank.min)?.name ?? rankLadder[0].name;
}

function progress(current: number, goal: number) {
  return Math.min(100, Math.round((current / Math.max(1, goal)) * 100));
}

function isEventType(event: CalendarEvent, type: string) {
  return normalizeEventType(event.eventType) === normalizeEventType(type);
}

function normalizeEventType(type: string) {
  return type.trim().toLowerCase();
}
