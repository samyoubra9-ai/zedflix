import { NextResponse } from "next/server";
import { handleTelegramUpdate } from "@/lib/telegram";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || "";
  if (secret && request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "Refusé" }, { status: 401 });
  }
  const update = await request.json().catch(() => ({}));
  await handleTelegramUpdate(update);
  return NextResponse.json({ ok: true });
}
