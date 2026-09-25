import { NextResponse } from "next/server";
import { ADMIN_COOKIE, isAdmin } from "@/lib/admin";

export const runtime = "nodejs";

export function GET(request: Request) {
  return NextResponse.json({ admin: isAdmin(request) });
}

export function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
