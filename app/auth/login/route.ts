import { NextResponse } from "next/server";
import { login } from "@/lib/accounts";
import { fail, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    return NextResponse.json(await login(String(body.email || ""), String(body.password || "")));
  } catch (error) {
    return fail(error);
  }
}
