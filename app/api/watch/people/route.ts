import { NextRequest, NextResponse } from "next/server";
import { AccountError } from "@/lib/accounts";
import { peopleCatalog } from "@/lib/watch";
import { requireWebAccount, seal } from "@/lib/web-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireWebAccount(request);
    const id = request.nextUrl.searchParams.get("id")?.trim() || "";
    const page = Number(request.nextUrl.searchParams.get("page") || "1");
    if (!id) {
      return seal(request, NextResponse.json({ error: "Acteur introuvable" }, { status: 400 }));
    }
    return seal(request, NextResponse.json(await peopleCatalog(id, page)));
  } catch (error) {
    if (error instanceof AccountError) {
      return seal(request, NextResponse.json({ error: error.message }, { status: error.status }));
    }
    const message = error instanceof Error ? error.message : "Acteur introuvable";
    return seal(request, NextResponse.json({ error: message }, { status: 502 }));
  }
}
