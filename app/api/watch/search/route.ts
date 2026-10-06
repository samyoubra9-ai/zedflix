import { NextRequest, NextResponse } from "next/server";
import { AccountError } from "@/lib/accounts";
import { parseSiteLang } from "@/lib/locale";
import { findPlayable, searchAnimeCatalog, searchCatalog, searchMore } from "@/lib/watch";
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
    const english = parseSiteLang(request.cookies.get("minuit_lang")?.value) === "en";
    if (request.nextUrl.searchParams.get("tab") === "anime") {
      return seal(request, NextResponse.json({ results: await searchAnimeCatalog(query), people: [] }));
    }
    if (request.nextUrl.searchParams.get("tab") === "turkey") {
      const { turkishSearch } = await import("@/lib/turkish");
      return seal(request, NextResponse.json({ results: await turkishSearch(query), people: [] }));
    }
    if (english) {
      if (request.nextUrl.searchParams.get("extra") === "1") {
        return seal(request, NextResponse.json({ results: [] }));
      }
      const { englishSearch } = await import("@/lib/english");
      return seal(request, NextResponse.json({ results: await englishSearch(query), people: [] }));
    }
    if (request.nextUrl.searchParams.get("extra") === "1") {
      const results = (await searchMore(query)).map(({ source: _source, ...item }) => item);
      return seal(request, NextResponse.json({ results }));
    }
    const catalog = await searchCatalog(query);
    return seal(request, NextResponse.json({
      ...catalog,
      results: catalog.results.map(({ source: _source, ...item }) => item),
    }));
  } catch (error) {
    if (error instanceof AccountError) {
      return seal(request, NextResponse.json({ error: error.message }, { status: error.status }));
    }
    const message = error instanceof Error ? error.message : "Recherche impossible";
    return seal(request, NextResponse.json({ error: message }, { status: 502 }));
  }
}
