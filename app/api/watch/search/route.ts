import { NextRequest, NextResponse } from "next/server";
import { AccountError } from "@/lib/accounts";
import { searchCatalog } from "@/lib/watch";
import { requireWebAccount } from "@/lib/web-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireWebAccount(request);
    const query = request.nextUrl.searchParams.get("q")?.trim() || "";
    if (query.length < 2) {
      return NextResponse.json({ error: "Écris au moins deux lettres" }, { status: 400 });
    }
    return NextResponse.json(await searchCatalog(query));
  } catch (error) {
    if (error instanceof AccountError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Recherche impossible";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
