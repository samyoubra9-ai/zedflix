import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminToken, passwordsMatch } from "@/lib/admin";
import { fail, readJson } from "@/lib/http";
import { AccountError } from "@/lib/accounts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    if (!passwordsMatch(String(body.password || ""))) {
      throw new AccountError("Mot de passe incorrect", 401);
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_COOKIE, adminToken(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return response;
  } catch (error) {
    return fail(error);
  }
}
