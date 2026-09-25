import { NextResponse } from "next/server";
import { refresh } from "@/lib/accounts";
import { fail, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    return NextResponse.json(await refresh(String(body.refreshToken || "")));
  } catch (error) {
    return fail(error);
  }
}
