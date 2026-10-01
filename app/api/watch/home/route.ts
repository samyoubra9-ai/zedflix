import { NextRequest, NextResponse } from "next/server";
import { AccountError } from "@/lib/accounts";
import { homeCatalog } from "@/lib/watch";
import { requireWebAccount, seal } from "@/lib/web-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireWebAccount(request);
    const home = await homeCatalog();
    const part = request.nextUrl.searchParams.get("part");
    if (part === "shelves" || part === "fresh") return seal(request, NextResponse.json({ rows: [] }));
    if (part === "spotlight") return seal(request, NextResponse.json({ hero: home.hero }));
    if (part === "rows") return seal(request, NextResponse.json({ rows: home.rows }));
    return seal(request, NextResponse.json(home));
  } catch (error) {
    if (error instanceof AccountError) {
      return seal(request, NextResponse.json({ error: error.message }, { status: error.status }));
    }
    const message = error instanceof Error ? error.message : "Catalogue indisponible";
    return seal(request, NextResponse.json({ error: message }, { status: 502 }));
  }
}
