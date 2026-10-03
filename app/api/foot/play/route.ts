import { NextRequest, NextResponse } from "next/server";
import { openFootChannel } from "@/lib/foot-play";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const channel = request.nextUrl.searchParams.get("channel")?.trim() || "";
  if (!channel || channel.length > 80) {
    return NextResponse.json({ error: "Chaîne introuvable" }, { status: 400 });
  }
  try {
    return NextResponse.json(await openFootChannel(channel));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lecture impossible";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
