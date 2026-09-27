import { NextRequest, NextResponse } from "next/server";
import { AccountError } from "@/lib/accounts";
import { showCatalog } from "@/lib/watch";
import { requireWebAccount } from "@/lib/web-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireWebAccount(request);
    const id = request.nextUrl.searchParams.get("id")?.trim() || "";
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ error: "Série introuvable" }, { status: 400 });
    }
    return NextResponse.json(await showCatalog(id));
  } catch (error) {
    if (error instanceof AccountError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Série introuvable";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
