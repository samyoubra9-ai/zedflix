import { NextRequest, NextResponse } from "next/server";
import { AccountError } from "@/lib/accounts";
import { liveCatalog } from "@/lib/live";
import { requireWebAccount } from "@/lib/web-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireWebAccount(request);
    const groups = await liveCatalog();
    return NextResponse.json({ groups });
  } catch (error) {
    if (error instanceof AccountError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "TV live indisponible";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
