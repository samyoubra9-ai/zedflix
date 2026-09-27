import { NextRequest, NextResponse } from "next/server";
import { AccountError } from "@/lib/accounts";
import { mediaPath, vidzyEpisode, vidzyPlaylist } from "@/lib/watch";
import { requireWebAccount } from "@/lib/web-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireWebAccount(request);
    const id = request.nextUrl.searchParams.get("id")?.trim() || "";
    const episode = Number(request.nextUrl.searchParams.get("episode") || "");
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ error: "Titre introuvable" }, { status: 400 });
    }
    const stream =
      Number.isInteger(episode) && episode > 0
        ? await vidzyEpisode(id, episode)
        : await vidzyPlaylist(id);
    return NextResponse.json({ src: mediaPath(stream) });
  } catch (error) {
    if (error instanceof AccountError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Lecture impossible";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
