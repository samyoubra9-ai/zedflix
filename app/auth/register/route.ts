import { NextResponse } from "next/server";
import { register } from "@/lib/accounts";
import { fail, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const result = await register(String(body.email || ""), String(body.password || ""));
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
