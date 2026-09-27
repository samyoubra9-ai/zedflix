import { NextResponse } from "next/server";
import { bearerToken } from "@/lib/accounts";
import { fail, readJson } from "@/lib/http";
import { syncLibrary } from "@/lib/library";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const doc = await syncLibrary(
      bearerToken(request),
      String(body.deviceId || ""),
      String(body.profileId || ""),
      String(body.provider || ""),
      body.favorites,
      body.resume,
    );
    return NextResponse.json(doc);
  } catch (error) {
    return fail(error);
  }
}
