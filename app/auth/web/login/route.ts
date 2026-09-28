import { NextResponse } from "next/server";
import { loginWeb } from "@/lib/accounts";
import { fail, readJson } from "@/lib/http";
import { ensureWebDevice, writeSession } from "@/lib/web-session";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const session = await loginWeb(String(body.email || ""), String(body.password || ""));
    const remember = Boolean(body.remember);
    const response = writeSession(NextResponse.json({ email: session.email }), session, { remember });
    ensureWebDevice(request, response);
    return response;
  } catch (error) {
    return fail(error);
  }
}
