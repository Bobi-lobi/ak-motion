export type AppPreferences = {
  browserNotifications: boolean;
  emailChatMessages: boolean;
  calendarFeedEventTypes: string[];
  calendarFeedLocations: string[];
  calendarFeedProfileIds: string[];
  calendarFeedScope: "all" | "assigned" | "types";
  defaultCalendarView: "month" | "week";
  notifyAdminUpdates: boolean;
  notifyAnnouncements: boolean;
  notifyAssignments: boolean;
  notifyChatMessages: boolean;
  notifyUnstaffed: boolean;
  notifyAchievements: boolean;
};

export const defaultPreferences: AppPreferences = {
  browserNotifications: false,
  emailChatMessages: false,
  calendarFeedEventTypes: [],
  calendarFeedLocations: [],
  calendarFeedProfileIds: [],
  calendarFeedScope: "assigned",
  defaultCalendarView: "month",
  notifyAdminUpdates: true,
  notifyAnnouncements: true,
  notifyAchievements: true,
  notifyAssignments: true,
  notifyChatMessages: true,
  notifyUnstaffed: true
};

const PREFERENCES_KEY = "ak-motion-preferences";

export function loadPreferences(): AppPreferences {
  if (typeof window === "undefined") {
    return defaultPreferences;
  }
  try {
    return {
      ...defaultPreferences,
      ...JSON.parse(window.localStorage.getItem(PREFERENCES_KEY) ?? "{}"),
      notifyAnnouncements: true
    };
  } catch {
    return defaultPreferences;
  }
}

export function savePreferences(preferences: AppPreferences) {
  const next = { ...preferences, notifyAnnouncements: true };
  window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("ak-motion-preferences", { detail: next }));
}
