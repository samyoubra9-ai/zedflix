import { NextRequest, NextResponse } from "next/server";
import { AccountError } from "@/lib/accounts";
import { curatedRows, curatedSpotlight, freshCatalog, homeCatalog } from "@/lib/watch";
import { requireWebAccount } from "@/lib/web-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireWebAccount(request);
    const part = request.nextUrl.searchParams.get("part");
    if (part === "shelves") return NextResponse.json({ rows: [] });
    if (part === "spotlight") return NextResponse.json(await curatedSpotlight());
    if (part === "rows") return NextResponse.json({ rows: await curatedRows() });
    if (part === "fresh") return NextResponse.json({ rows: await freshCatalog() });
    return NextResponse.json(await homeCatalog());
  } catch (error) {
    if (error instanceof AccountError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "L’accueil est indisponible";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
