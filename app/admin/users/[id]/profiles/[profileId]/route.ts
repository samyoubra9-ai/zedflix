import { NextResponse } from "next/server";
import { adminDeleteProfile, adminExtendProfile, adminUpdateProfile } from "@/lib/accounts";
import { requireAdmin } from "@/lib/admin";
import { fail, readJson } from "@/lib/http";
import { removeLibraryFolder } from "@/lib/library";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string; profileId: string }> }) {
  try {
    requireAdmin(request);
    const { id, profileId } = await context.params;
    const body = await readJson(request);
    if (body.extend === true || body.months != null || body.days != null) {
      return NextResponse.json(
        await adminExtendProfile(id, profileId, {
          months: body.months,
          days: body.days,
        }),
      );
    }
    const profile = await adminUpdateProfile(
      id,
      profileId,
      String(body.name || ""),
      String(body.pin || ""),
      body.catalogAccess,
    );
    return NextResponse.json(profile);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string; profileId: string }> }) {
  try {
    requireAdmin(request);
    const { id, profileId } = await context.params;
    await adminDeleteProfile(id, profileId);
    await removeLibraryFolder(id, profileId).catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
