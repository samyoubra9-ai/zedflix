import { NextRequest, NextResponse } from "next/server";
import { AccountError } from "@/lib/accounts";
import { allowedMediaUrl, fetchMedia, rewritePlaylist } from "@/lib/watch";
import { requireWebAccount } from "@/lib/web-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireWebAccount(request);
  } catch (error) {
    const status = error instanceof AccountError ? error.status : 401;
    return NextResponse.json({ error: "Connexion requise" }, { status });
  }
  const url = request.nextUrl.searchParams.get("url") || "";
  if (!allowedMediaUrl(url)) {
    return NextResponse.json({ error: "Adresse refusée" }, { status: 400 });
  }
  const upstream = await fetchMedia(url);
  if (!upstream.ok) {
    return NextResponse.json({ error: "Le flux n’a pas répondu" }, { status: 502 });
  }
  const type = upstream.headers.get("content-type") || "";
  const playlist = type.includes("mpegurl") || type.includes("mpegURL") || url.includes(".m3u8");
  if (playlist) {
    const body = rewritePlaylist(await upstream.text(), url);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "no-store",
      },
    });
  }
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": type || "video/mp2t",
      "Cache-Control": "no-store",
    },
  });
}
