import { NextRequest, NextResponse } from "next/server";
import { AccountError } from "@/lib/accounts";
import { allowedMediaUrl, fetchMedia, preparePlaylist } from "@/lib/watch";
import { requireWebAccount, seal } from "@/lib/web-session";

export const runtime = "edge";
export const dynamic = "force-dynamic";

async function binaryMedia(upstream: Response, type: string, url: string) {
  const bytes = new Uint8Array(await upstream.arrayBuffer());
  const contentType =
    type.includes("text/html") || type.includes("text/plain")
      ? url.includes(".ts")
        ? "video/mp2t"
        : "video/mp4"
      : type || "video/mp2t";
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      "Content-Length": String(bytes.byteLength),
    },
  });
}

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
    const range = request.headers.get("range");
    upstream = await fetchMedia(
      url,
      playlistUrl ? 8000 : liveFile ? 45000 : 25000,
      range && /\.(mp4|webm|mkv)(\?|$)/i.test(url) ? { Range: range } : undefined,
    );
  } catch {
    return NextResponse.json({ error: "Le flux n’a pas répondu" }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Le flux n’a pas répondu" }, { status: 502 });
  }
  const type = upstream.headers.get("content-type") || "";
  const playlist = playlistUrl || type.includes("mpegurl") || type.includes("mpegURL");
  const file = !playlist && /\.(mp4|webm|mkv)(\?|$)/i.test(url);
  if (file) {
    const headers = new Headers();
    headers.set("Content-Type", type.startsWith("video/") ? type : "video/mp4");
    headers.set("Cache-Control", "no-store");
    headers.set("Accept-Ranges", "bytes");
    const length = upstream.headers.get("content-length");
    const contentRange = upstream.headers.get("content-range");
    if (length) headers.set("Content-Length", length);
    if (contentRange) headers.set("Content-Range", contentRange);
    const response = new NextResponse(upstream.body, { status: upstream.status === 206 ? 206 : 200, headers });
    return known ? response : seal(request, response);
  }
  const response = playlist
    ? new NextResponse(preparePlaylist(await upstream.text(), url), {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-store",
        },
      })
    : await binaryMedia(upstream, type, url);
  return known ? response : seal(request, response);
}
