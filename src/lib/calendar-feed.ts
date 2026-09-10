import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

function feedSecret() {
  const secret = process.env.CALENDAR_FEED_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("Kalender-Feed ist nicht konfiguriert.");
  }
  return secret;
}

export type CalendarFeedScope = "all" | "assigned" | "types";

export type CalendarFeedSelection = {
  eventTypes: string[];
  locations: string[];
  profileIds: string[];
  scope: CalendarFeedScope;
  userId: string;
};

export function createCalendarFeedToken(selection: CalendarFeedSelection) {
  const payload = Buffer.from(JSON.stringify(selection)).toString("base64url");
  const signature = createHmac("sha256", feedSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readCalendarFeedToken(token: string) {
  const [encodedUserId, signature] = token.split(".");
  if (!encodedUserId || !signature) return null;
  const decoded = Buffer.from(encodedUserId, "base64url").toString("utf8");
  const isCurrentToken = decoded.startsWith("{");
  const expected = createHmac("sha256", feedSecret()).update(isCurrentToken ? encodedUserId : decoded).digest("base64url");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }
  if (!isCurrentToken) return { eventTypes: [], locations: [], profileIds: [], scope: "assigned" as const, userId: decoded };
  try {
    const value = JSON.parse(decoded) as CalendarFeedSelection;
    if (!value.userId || !["all", "assigned", "types"].includes(value.scope)) return null;
    return {
      eventTypes: Array.isArray(value.eventTypes) ? value.eventTypes.filter((item) => typeof item === "string") : [],
      locations: Array.isArray(value.locations) ? value.locations.filter((item) => typeof item === "string") : [],
      profileIds: Array.isArray(value.profileIds) ? value.profileIds.filter((item) => typeof item === "string") : [],
      scope: value.scope,
      userId: value.userId
    };
  } catch {
    return null;
  }
}

export function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function icsDate(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
