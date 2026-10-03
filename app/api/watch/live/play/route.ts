import { NextRequest, NextResponse } from "next/server";
import { AccountError } from "@/lib/accounts";
import { resolveLiveStream } from "@/lib/live";
import { mediaPath } from "@/lib/watch";
import { hasWebSession, requireWebAccount, seal } from "@/lib/web-session";

export const dynamic = "force-dynamic";
export const preferredRegion = "cdg1";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const known = hasWebSession(request);
  if (!known) {
    try {
      await requireWebAccount(request);
    } catch (error) {
      const status = error instanceof AccountError ? error.status : 401;
      return NextResponse.json({ error: "Connexion requise" }, { status });
    }
  }
  try {
    const id = request.nextUrl.searchParams.get("id")?.trim() || "";
    if (!id) {
      return NextResponse.json({ error: "Chaîne introuvable" }, { status: 400 });
    }
    const result = await resolveLiveStream(id);
    const response = NextResponse.json({
      src: mediaPath(result.stream),
      title: result.name,
      poster: result.logo,
      live: true,
    });
    return known ? response : seal(request, response);
  } catch (error) {
    if (error instanceof AccountError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Lecture live impossible";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
