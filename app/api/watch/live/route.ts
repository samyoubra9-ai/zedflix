import { NextRequest, NextResponse } from "next/server";
import { AccountError } from "@/lib/accounts";
import { liveCatalog } from "@/lib/live";
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
    const groups = await liveCatalog();
    const response = NextResponse.json({ groups });
    return known ? response : seal(request, response);
  } catch (error) {
    if (error instanceof AccountError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "TV live indisponible";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
