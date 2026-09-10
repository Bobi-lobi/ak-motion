export type AppPreferences = {
  browserNotifications: boolean;
  calendarFeedEventTypes: string[];
  calendarFeedScope: "all" | "assigned" | "types";
  defaultCalendarView: "month" | "week";
  notifyAdminUpdates: boolean;
  notifyAnnouncements: boolean;
  notifyAssignments: boolean;
  notifyUnstaffed: boolean;
  notifyAchievements: boolean;
};

export const defaultPreferences: AppPreferences = {
  browserNotifications: false,
  calendarFeedEventTypes: [],
  calendarFeedScope: "assigned",
  defaultCalendarView: "month",
  notifyAdminUpdates: true,
  notifyAnnouncements: true,
  notifyAchievements: true,
  notifyAssignments: true,
  notifyUnstaffed: true
};

const PREFERENCES_KEY = "ak-motion-preferences";

export function loadPreferences(): AppPreferences {
  if (typeof window === "undefined") {
    return defaultPreferences;
  }
  try {
    return { ...defaultPreferences, ...JSON.parse(window.localStorage.getItem(PREFERENCES_KEY) ?? "{}") };
  } catch {
    return defaultPreferences;
  }
}

export function savePreferences(preferences: AppPreferences) {
  window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  window.dispatchEvent(new CustomEvent("ak-motion-preferences", { detail: preferences }));
}
