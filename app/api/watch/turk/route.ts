import { NextRequest, NextResponse } from "next/server";
import { AccountError } from "@/lib/accounts";
import { LANG_COOKIE, parseSiteLang } from "@/lib/locale";
import { turkishCatalog } from "@/lib/turkish";
import { requireWebAccount, seal } from "@/lib/web-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireWebAccount(request);
    const lang = parseSiteLang(request.cookies.get(LANG_COOKIE)?.value);
    return seal(request, NextResponse.json(await turkishCatalog(lang)));
  } catch (error) {
    if (error instanceof AccountError) {
      return seal(request, NextResponse.json({ error: error.message }, { status: error.status }));
    }
    const message = error instanceof Error ? error.message : "Catalogue indisponible";
    return seal(request, NextResponse.json({ error: message }, { status: 502 }));
  }
}
