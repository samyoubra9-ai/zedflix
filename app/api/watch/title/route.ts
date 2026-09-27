import { NextRequest, NextResponse } from "next/server";
import { AccountError } from "@/lib/accounts";
import { titleCatalog } from "@/lib/watch";
import { requireWebAccount } from "@/lib/web-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireWebAccount(request);
    const id = request.nextUrl.searchParams.get("id")?.trim() || "";
    const kind = request.nextUrl.searchParams.get("kind") === "show" ? "show" : "movie";
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ error: "Titre introuvable" }, { status: 400 });
    }
    return NextResponse.json(await titleCatalog(id, kind));
  } catch (error) {
    if (error instanceof AccountError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Titre introuvable";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
