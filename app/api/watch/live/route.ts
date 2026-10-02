import { NextRequest, NextResponse } from "next/server";
import { AccountError } from "@/lib/accounts";
import { liveCatalogSlice } from "@/lib/live";
import { hasWebSession, requireWebAccount, seal } from "@/lib/web-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const known = hasWebSession(request);
  if (!known) {
    try {
      await requireWebAccount(request);
    } catch (error) {
      const status = error instanceof AccountError ? error.status : 401;
      return NextResponse.json({ error: "Connexion requise" }, { status });
    }
  }
  try {
    const page = await liveCatalogSlice(request.nextUrl.searchParams.get("cursor"));
    const response = NextResponse.json(page);
    return known ? response : seal(request, response);
  } catch (error) {
    if (error instanceof AccountError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "TV live indisponible";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
