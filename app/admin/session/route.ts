import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";

export const runtime = "nodejs";

export function GET(request: Request) {
  return NextResponse.json({ admin: isAdmin(request) });
}
