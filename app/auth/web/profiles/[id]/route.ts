import { NextRequest, NextResponse } from "next/server";
import { updateOwnProfile } from "@/lib/accounts";
import { fail, readJson } from "@/lib/http";
import { ensureWebDevice, webAccount, writeSession } from "@/lib/web-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const account = await webAccount(request);
    const body = await readJson(request);
    const shell = NextResponse.json({ ok: true });
    if (account.session) writeSession(shell, account.session, { remember: account.remember });
    const { deviceId } = ensureWebDevice(request, shell);

    const profile = await updateOwnProfile(account.accessToken, deviceId, id, {
      currentPin: body.currentPin != null ? String(body.currentPin) : undefined,
      pin: body.pin != null ? String(body.pin) : undefined,
      clearPin: Boolean(body.clearPin),
      name: body.name != null ? String(body.name) : undefined,
      color: body.color != null ? Number(body.color) : undefined,
    });

    const response = NextResponse.json({ profile });
    shell.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  } catch (error) {
    return fail(error);
  }
}
