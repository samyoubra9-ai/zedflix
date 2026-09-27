import { NextResponse } from "next/server";
import { createProfile, listProfiles } from "@/lib/accounts";
import { fail, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const header = request.headers.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const profiles = await listProfiles(token, url.searchParams.get("deviceId") || "");
    return NextResponse.json({ profiles });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const header = request.headers.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const profile = await createProfile(
      token,
      String(body.deviceId || ""),
      String(body.name || ""),
      String(body.pin || ""),
      String(body.id || ""),
      Number(body.color),
    );
    return NextResponse.json(profile);
  } catch (error) {
    return fail(error);
  }
}
