import { NextRequest, NextResponse } from "next/server";
import { AccountError } from "@/lib/accounts";
import { mediaPath, resolveEpisode, resolvePlaylist } from "@/lib/watch";
import { requireWebAccount } from "@/lib/web-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireWebAccount(request);
    const id = request.nextUrl.searchParams.get("id")?.trim() || "";
    const episode = Number(request.nextUrl.searchParams.get("episode") || "");
    const server = request.nextUrl.searchParams.get("server")?.trim() || undefined;
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ error: "Titre introuvable" }, { status: 400 });
    }
    const result =
      Number.isInteger(episode) && episode > 0
        ? await resolveEpisode(id, episode, server)
        : await resolvePlaylist(id, server);
    return NextResponse.json({
      src: mediaPath(result.stream),
      server: result.server,
      servers: result.servers,
    });
  } catch (error) {
    if (error instanceof AccountError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Lecture impossible";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
