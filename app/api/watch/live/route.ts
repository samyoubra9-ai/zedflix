import { NextRequest, NextResponse } from "next/server";
import { AccountError } from "@/lib/accounts";
import { liveCatalog } from "@/lib/live";
import { requireWebAccount, seal } from "@/lib/web-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireWebAccount(request);
    const groups = await liveCatalog();
    return seal(request, NextResponse.json({ groups }));
  } catch (error) {
    if (error instanceof AccountError) {
      return seal(request, NextResponse.json({ error: error.message }, { status: error.status }));
    }
    const message = error instanceof Error ? error.message : "TV live indisponible";
    return seal(request, NextResponse.json({ error: message }, { status: 502 }));
  }
}
