import { NextResponse } from "next/server";
import { registrationOpen, supabaseConfigured } from "@/lib/accounts";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    ok: true,
    registration: registrationOpen(),
    supabase: supabaseConfigured(),
  });
}
