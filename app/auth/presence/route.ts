import { NextResponse } from "next/server";
import { bearerToken, presence } from "@/lib/accounts";
import { fail, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    return NextResponse.json(await presence(bearerToken(request), String(body.deviceId || "")));
  } catch (error) {
    return fail(error);
  }
}
