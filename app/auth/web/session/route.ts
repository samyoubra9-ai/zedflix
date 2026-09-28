import { NextRequest, NextResponse } from "next/server";
import {
  AccountError,
  deviceLabelFromUa,
  listPublicProfiles,
  touchWebDevice,
} from "@/lib/accounts";
import {
  currentProfileId,
  ensureWebDevice,
  webAccount,
  writeSession,
} from "@/lib/web-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const account = await webAccount(request);
    const profiles = await listPublicProfiles(account.accessToken);
    const profileId = currentProfileId(request);
    const selected = profiles.find((profile) => profile.id === profileId) || null;
    const response = NextResponse.json({
      email: account.email,
      profile: selected,
      profiles,
      remember: account.remember,
    });
    if (account.session) writeSession(response, account.session, { remember: account.remember });
    const { deviceId } = ensureWebDevice(request, response);
    await touchWebDevice(
      account.accessToken,
      deviceId,
      deviceLabelFromUa(request.headers.get("user-agent") || ""),
    ).catch(() => undefined);
    return response;
  } catch (error) {
    const status = error instanceof AccountError ? error.status : 401;
    return NextResponse.json({ error: "Connexion requise" }, { status });
  }
}
