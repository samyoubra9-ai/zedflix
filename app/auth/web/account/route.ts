import { NextRequest, NextResponse } from "next/server";
import {
  AccountError,
  deviceLabelFromUa,
  listConnectedDevices,
  listPublicProfiles,
  revokeDevice,
  touchWebDevice,
} from "@/lib/accounts";
import { fail, readJson } from "@/lib/http";
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
    const shell = NextResponse.next();
    if (account.session) writeSession(shell, account.session, { remember: account.remember });
    const { deviceId } = ensureWebDevice(request, shell);
    await touchWebDevice(
      account.accessToken,
      deviceId,
      deviceLabelFromUa(request.headers.get("user-agent") || ""),
    ).catch(() => undefined);
    const devices = await listConnectedDevices(account.accessToken, deviceId);
    const response = NextResponse.json({
      email: account.email,
      profile: selected,
      profiles,
      devices,
      deviceId,
      remember: account.remember,
    });
    shell.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value, cookie);
    });
    return response;
  } catch (error) {
    const status = error instanceof AccountError ? error.status : 401;
    return NextResponse.json({ error: "Connexion requise" }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const account = await webAccount(request);
    const body = await readJson(request);
    const action = String(body.action || "");
    const response = NextResponse.json({ ok: true });
    if (account.session) writeSession(response, account.session, { remember: account.remember });
    const { deviceId } = ensureWebDevice(request, response);

    if (action === "revoke-device") {
      await revokeDevice(account.accessToken, deviceId, String(body.deviceId || ""));
      return response;
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (error) {
    return fail(error);
  }
}
