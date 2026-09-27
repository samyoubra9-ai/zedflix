import { NextRequest, NextResponse } from "next/server";
import { AccountError } from "@/lib/accounts";
import { listWebProfiles, selectWebProfile, clearWebProfile } from "@/lib/web-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    return await listWebProfiles(request);
  } catch (error) {
    const status = error instanceof AccountError ? error.status : 401;
    return NextResponse.json(
      { error: error instanceof AccountError ? error.message : "Connexion requise" },
      { status },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      profileId?: string;
      pin?: string;
      clear?: boolean;
    };
    if (body.clear) return await clearWebProfile(request);
    const profileId = String(body.profileId || "").trim();
    if (!profileId) {
      return NextResponse.json({ error: "Profil requis" }, { status: 400 });
    }
    return await selectWebProfile(request, profileId, String(body.pin || ""));
  } catch (error) {
    const status = error instanceof AccountError ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof AccountError ? error.message : "Profil indisponible" },
      { status },
    );
  }
}
