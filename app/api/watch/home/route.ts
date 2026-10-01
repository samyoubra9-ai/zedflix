import { NextRequest, NextResponse } from "next/server";
import { AccountError } from "@/lib/accounts";
import { curatedRows, curatedSpotlight, freshCatalog, homeCatalog } from "@/lib/watch";
import { requireWebAccount, seal } from "@/lib/web-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireWebAccount(request);
    const part = request.nextUrl.searchParams.get("part");
    if (part === "shelves") return seal(request, NextResponse.json({ rows: [] }));
    if (part === "spotlight") return seal(request, NextResponse.json(await curatedSpotlight()));
    if (part === "rows") return seal(request, NextResponse.json({ rows: await curatedRows() }));
    if (part === "fresh") return seal(request, NextResponse.json({ rows: await freshCatalog() }));
    return seal(request, NextResponse.json(await homeCatalog()));
  } catch (error) {
    if (error instanceof AccountError) {
      return seal(request, NextResponse.json({ error: error.message }, { status: error.status }));
    }
    const message = error instanceof Error ? error.message : "L’accueil est indisponible";
    return seal(request, NextResponse.json({ error: message }, { status: 502 }));
  }
}
