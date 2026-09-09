import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

function feedSecret() {
  const secret = process.env.CALENDAR_FEED_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("Kalender-Feed ist nicht konfiguriert.");
  }
  return secret;
}

export function createCalendarFeedToken(userId: string) {
  const signature = createHmac("sha256", feedSecret()).update(userId).digest("base64url");
  return `${Buffer.from(userId).toString("base64url")}.${signature}`;
}

export function readCalendarFeedToken(token: string) {
  const [encodedUserId, signature] = token.split(".");
  if (!encodedUserId || !signature) return null;
  const userId = Buffer.from(encodedUserId, "base64url").toString("utf8");
  const expected = createHmac("sha256", feedSecret()).update(userId).digest("base64url");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }
  return userId;
}

export function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function icsDate(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
