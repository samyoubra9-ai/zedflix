import { NextRequest, NextResponse } from "next/server";
import { AccountError } from "@/lib/accounts";
import { resolveLiveStream } from "@/lib/live";
import { mediaPath } from "@/lib/watch";
import { requireWebAccount, seal } from "@/lib/web-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireWebAccount(request);
    const id = request.nextUrl.searchParams.get("id")?.trim() || "";
    if (!id) {
      return seal(request, NextResponse.json({ error: "Chaîne introuvable" }, { status: 400 }));
    }
    const result = await resolveLiveStream(id);
    return seal(request, NextResponse.json({
      src: mediaPath(result.stream),
      title: result.name,
      poster: result.logo,
      live: true,
    }));
  } catch (error) {
    if (error instanceof AccountError) {
      return seal(request, NextResponse.json({ error: error.message }, { status: error.status }));
    }
    const message = error instanceof Error ? error.message : "Lecture live impossible";
    return seal(request, NextResponse.json({ error: message }, { status: 502 }));
  }
}
