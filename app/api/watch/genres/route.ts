import { NextRequest, NextResponse } from "next/server";
import { AccountError } from "@/lib/accounts";
import { genreCatalog, listGenres } from "@/lib/watch";
import { requireWebAccount, seal } from "@/lib/web-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireWebAccount(request);
    const id = request.nextUrl.searchParams.get("id")?.trim() || "";
    const page = Number(request.nextUrl.searchParams.get("page") || "1");
    const kindParam = request.nextUrl.searchParams.get("kind");
    const kind = kindParam === "movie" || kindParam === "show" ? kindParam : "all";
    if (!id) {
      return seal(request, NextResponse.json({ genres: await listGenres() }));
    }
    return seal(request, NextResponse.json(await genreCatalog(id, page, kind)));
  } catch (error) {
    if (error instanceof AccountError) {
      return seal(request, NextResponse.json({ error: error.message }, { status: error.status }));
    }
    const message = error instanceof Error ? error.message : "Genre indisponible";
    return seal(request, NextResponse.json({ error: message }, { status: 502 }));
  }
}
