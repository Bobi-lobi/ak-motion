import { NextResponse } from "next/server";
import { dispatchNonChatEmails } from "@/lib/notification-email";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Nicht autorisiert.", { status: 401 });
  }
  try {
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const result = await dispatchNonChatEmails(origin);
    return NextResponse.json(result, { status: result.failed ? 502 : 200 });
  } catch (error) {
    console.error("Hinweis-E-Mail-Job fehlgeschlagen:", error);
    return NextResponse.json({ error: "Hinweis-E-Mail-Job fehlgeschlagen." }, { status: 500 });
  }
}
