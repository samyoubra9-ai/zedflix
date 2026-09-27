import { NextResponse } from "next/server";
import { bearerToken, deleteProfile, updateProfile } from "@/lib/accounts";
import { fail, readJson } from "@/lib/http";
import { removeLibrary } from "@/lib/library";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readJson(request);
    const header = request.headers.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const profile = await updateProfile(
      token,
      String(body.deviceId || ""),
      id,
      String(body.currentPin || ""),
      String(body.pin || ""),
    );
    return NextResponse.json(profile);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await readJson(request);
    const header = request.headers.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const deviceId = String(body.deviceId || "");
    await deleteProfile(token, deviceId, id);
    await removeLibrary(bearerToken(request), deviceId, id).catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
