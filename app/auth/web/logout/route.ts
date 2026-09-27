import { NextRequest, NextResponse } from "next/server";
import { clearSession, endWebSession } from "@/lib/web-session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  await endWebSession(request).catch(() => undefined);
  return clearSession(NextResponse.json({ ok: true }));
}
