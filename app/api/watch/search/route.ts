import { NextRequest, NextResponse } from "next/server";
import { AccountError } from "@/lib/accounts";
import { findPlayable, searchCatalog, searchMore } from "@/lib/watch";
import { requireWebAccount, seal } from "@/lib/web-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireWebAccount(request);
    const query = request.nextUrl.searchParams.get("q")?.trim() || "";
    if (query.length < 2) {
      return seal(request, NextResponse.json({ error: "Écris au moins deux lettres" }, { status: 400 }));
    }
    if (request.nextUrl.searchParams.get("match") === "1") {
      const hit = await findPlayable(query);
      if (!hit) return seal(request, NextResponse.json({ error: "Pas encore disponible à la lecture" }, { status: 404 }));
      return seal(request, NextResponse.json({ result: hit }));
    }
    if (request.nextUrl.searchParams.get("extra") === "1") {
      return seal(request, NextResponse.json({ results: await searchMore(query) }));
    }
    return seal(request, NextResponse.json(await searchCatalog(query)));
  } catch (error) {
    if (error instanceof AccountError) {
      return seal(request, NextResponse.json({ error: error.message }, { status: error.status }));
    }
    const message = error instanceof Error ? error.message : "Recherche impossible";
    return seal(request, NextResponse.json({ error: message }, { status: 502 }));
  }
}
