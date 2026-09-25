import { NextResponse } from "next/server";
import { bearerToken, logout } from "@/lib/accounts";
import { fail, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await readJson(request);
    await logout(bearerToken(request));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
