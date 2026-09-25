import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function POST() {
  return NextResponse.json(
    { error: "Les inscriptions se font par l'administrateur" },
    { status: 403 },
  );
}
