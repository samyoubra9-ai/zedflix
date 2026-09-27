import { NextRequest, NextResponse } from "next/server";
import { AccountError } from "@/lib/accounts";
import { homeCatalog } from "@/lib/watch";
import { requireWebAccount } from "@/lib/web-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireWebAccount(request);
    return NextResponse.json(await homeCatalog());
  } catch (error) {
    if (error instanceof AccountError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "L’accueil est indisponible";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
