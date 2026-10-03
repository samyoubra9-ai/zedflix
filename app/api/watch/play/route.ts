import { NextRequest, NextResponse } from "next/server";
import { AccountError } from "@/lib/accounts";
import { EnglishChoiceNeededError, isWatchId, mediaPath, resolveEpisode, resolvePlaylist } from "@/lib/watch";
import { requireWebAccount, seal } from "@/lib/web-session";

export const dynamic = "force-dynamic";
export const preferredRegion = "cdg1";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    await requireWebAccount(request);
    const id = request.nextUrl.searchParams.get("id")?.trim() || "";
    const episode = Number(request.nextUrl.searchParams.get("episode") || "");
    const server = request.nextUrl.searchParams.get("server")?.trim() || undefined;
    const allowEnglish = request.nextUrl.searchParams.get("allowEnglish") === "1";
    if (!isWatchId(id)) {
      return seal(request, NextResponse.json({ error: "Titre introuvable" }, { status: 400 }));
    }
    const options = { preferredServer: server, allowEnglish };
    const result =
      Number.isInteger(episode) && episode > 0
        ? await resolveEpisode(id, episode, options)
        : await resolvePlaylist(id, options);
    return seal(request, NextResponse.json({
      src: mediaPath(result.stream),
      server: result.server,
      servers: result.servers,
      language: result.language,
      version: result.version,
    }));
  } catch (error) {
    if (error instanceof AccountError) {
      return seal(request, NextResponse.json({ error: error.message }, { status: error.status }));
    }
    if (error instanceof EnglishChoiceNeededError) {
      return seal(request, NextResponse.json(
        {
          needsEnglishChoice: true,
          servers: error.servers,
          error: "Aucune version française détectée",
        },
        { status: 409 },
      ));
    }
    const message = error instanceof Error ? error.message : "Lecture impossible";
    return seal(request, NextResponse.json({ error: message }, { status: 502 }));
  }
}
