import { NextRequest, NextResponse } from "next/server";
import { footMediaPath, readFootMediaToken } from "@/lib/foot-play";
import { allowedMediaUrl, fetchMedia } from "@/lib/watch";

export const dynamic = "force-dynamic";

function rewrite(body: string, playlistUrl: string) {
  return body
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
          return `URI="${footMediaPath(new URL(uri, playlistUrl).toString())}"`;
        });
      }
      try {
        return footMediaPath(new URL(trimmed, playlistUrl).toString());
      } catch {
        return line;
      }
    })
    .join("\n");
}

export async function GET(request: NextRequest) {
  const url = readFootMediaToken(request.nextUrl.searchParams.get("t") || "");
  if (!url || !allowedMediaUrl(url)) {
    return NextResponse.json({ error: "Adresse refusée" }, { status: 400 });
  }
  const playlistUrl = url.includes(".m3u8");
  let upstream: Response;
  try {
    const liveFile = !playlistUrl && (url.includes("/hls/") || url.includes("sunshine"));
    upstream = await fetchMedia(url, playlistUrl ? 8000 : liveFile ? 45000 : 25000);
  } catch {
    return NextResponse.json({ error: "Le flux n'a pas répondu" }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Le flux n'a pas répondu" }, { status: 502 });
  }
  const type = upstream.headers.get("content-type") || "";
  const playlist = playlistUrl || type.includes("mpegurl") || type.includes("mpegURL");
  if (!playlist) {
    const length = upstream.headers.get("content-length");
    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": type || "video/mp2t",
        "Cache-Control": "no-store",
        ...(length ? { "Content-Length": length } : {}),
      },
    });
  }
  return new NextResponse(rewrite(await upstream.text(), url), {
    headers: {
      "Content-Type": "application/vnd.apple.mpegurl",
      "Cache-Control": "no-store",
    },
  });
}
