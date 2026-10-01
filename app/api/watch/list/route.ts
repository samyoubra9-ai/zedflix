import { NextRequest, NextResponse } from "next/server";
import { AccountError } from "@/lib/accounts";
import { listCatalog } from "@/lib/watch";
import { requireWebAccount, seal } from "@/lib/web-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireWebAccount(request);
    const kind = request.nextUrl.searchParams.get("kind") === "show" ? "show" : "movie";
    const page = Number(request.nextUrl.searchParams.get("page") || "1");
    return seal(request, NextResponse.json(await listCatalog(kind, page)));
  } catch (error) {
    if (error instanceof AccountError) {
      return seal(request, NextResponse.json({ error: error.message }, { status: error.status }));
    }
    const message = error instanceof Error ? error.message : "Catalogue indisponible";
    return seal(request, NextResponse.json({ error: message }, { status: 502 }));
  }
}
