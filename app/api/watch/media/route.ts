import { NextRequest, NextResponse } from "next/server";
import { AccountError } from "@/lib/accounts";
import { allowedMediaUrl, fetchMedia, preparePlaylist } from "@/lib/watch";
import { requireWebAccount, seal } from "@/lib/web-session";

export const dynamic = "force-dynamic";

function sessionPresent(request: NextRequest) {
  return Boolean(
    request.cookies.get("minuit_access")?.value || request.cookies.get("minuit_refresh")?.value,
  );
}

export async function GET(request: NextRequest) {
  const known = sessionPresent(request);
  if (!known) {
    try {
      await requireWebAccount(request);
    } catch (error) {
      const status = error instanceof AccountError ? error.status : 401;
      return NextResponse.json({ error: "Connexion requise" }, { status });
    }
  }
  const url = request.nextUrl.searchParams.get("url") || "";
  if (!allowedMediaUrl(url)) {
    return NextResponse.json({ error: "Adresse refusée" }, { status: 400 });
  }
  const playlistUrl = url.includes(".m3u8") || url.includes("/playlist/");
  let upstream: Response;
  try {
    const liveFile = !playlistUrl && (url.includes("/hls/") || url.includes("sunshine"));
    upstream = await fetchMedia(url, playlistUrl ? 8000 : liveFile ? 45000 : 25000);
  } catch {
    return NextResponse.json({ error: "Le flux n’a pas répondu" }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Le flux n’a pas répondu" }, { status: 502 });
  }
  const type = upstream.headers.get("content-type") || "";
  const playlist = playlistUrl || type.includes("mpegurl") || type.includes("mpegURL");
  const length = upstream.headers.get("content-length");
  const response = playlist
    ? new NextResponse(preparePlaylist(await upstream.text(), url), {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-store",
        },
      })
    : new NextResponse(upstream.body, {
        headers: {
          "Content-Type":
            type.includes("text/html") || type.includes("text/plain")
              ? url.includes(".ts")
                ? "video/mp2t"
                : "video/mp4"
              : type || "video/mp2t",
          "Cache-Control": "no-store",
          ...(length ? { "Content-Length": length } : {}),
        },
      });
  return known ? response : seal(request, response);
}
