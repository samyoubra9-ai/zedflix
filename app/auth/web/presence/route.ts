import { NextRequest, NextResponse } from "next/server";
import { AccountError } from "@/lib/accounts";
import { webPresence } from "@/lib/web-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    return await webPresence(request);
  } catch (error) {
    const status = error instanceof AccountError ? error.status : 401;
    return NextResponse.json(
      { error: error instanceof AccountError ? error.message : "Session expirée", ok: false },
      { status },
    );
  }
}
