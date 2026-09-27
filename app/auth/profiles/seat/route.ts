import { NextResponse } from "next/server";
import { bearerToken, claimProfile, releaseSeats } from "@/lib/accounts";
import { fail, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const deviceId = String(body.deviceId || "");
    const profileId = String(body.profileId || "");
    const token = bearerToken(request);
    if (!profileId) return NextResponse.json(await releaseSeats(token, deviceId));
    return NextResponse.json(await claimProfile(token, deviceId, profileId));
  } catch (error) {
    return fail(error);
  }
}
