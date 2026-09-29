import { NextResponse } from "next/server";
import { adminCreateProfile, adminListProfiles } from "@/lib/accounts";
import { requireAdmin } from "@/lib/admin";
import { fail, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await context.params;
    return NextResponse.json({ profiles: await adminListProfiles(id) });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await context.params;
    const body = await readJson(request);
    const monthsRaw = body.months;
    const months =
      monthsRaw === null || monthsRaw === undefined || body.trial === true
        ? null
        : Number(monthsRaw);
    const profile = await adminCreateProfile(
      id,
      String(body.name || ""),
      String(body.pin || ""),
      months,
    );
    return NextResponse.json(profile);
  } catch (error) {
    return fail(error);
  }
}
