import { NextRequest, NextResponse } from "next/server";
import { AccountError } from "@/lib/accounts";
import { isWatchId, titleCatalog } from "@/lib/watch";
import { requireWebAccount, seal } from "@/lib/web-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireWebAccount(request);
    const id = request.nextUrl.searchParams.get("id")?.trim() || "";
    const kind = request.nextUrl.searchParams.get("kind") === "show" ? "show" : "movie";
    if (!isWatchId(id)) {
      return seal(request, NextResponse.json({ error: "Titre introuvable" }, { status: 400 }));
    }
    return seal(request, NextResponse.json(await titleCatalog(id, kind)));
  } catch (error) {
    if (error instanceof AccountError) {
      return seal(request, NextResponse.json({ error: error.message }, { status: error.status }));
    }
    const message = error instanceof Error ? error.message : "Titre introuvable";
    return seal(request, NextResponse.json({ error: message }, { status: 502 }));
  }
}
