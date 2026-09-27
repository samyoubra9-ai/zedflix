import { NextResponse } from "next/server";
import { loginWeb } from "@/lib/accounts";
import { fail, readJson } from "@/lib/http";
import { writeSession } from "@/lib/web-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const session = await loginWeb(String(body.email || ""), String(body.password || ""));
    return writeSession(NextResponse.json({ email: session.email }), session);
  } catch (error) {
    return fail(error);
  }
}
