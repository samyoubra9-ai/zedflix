import { NextResponse } from "next/server";
import { bearerToken, logout } from "@/lib/accounts";
import { fail, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    await logout(bearerToken(request), String(body.deviceId || ""));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
