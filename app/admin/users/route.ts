import { NextResponse } from "next/server";
import { createAccount, listAccounts } from "@/lib/accounts";
import { requireAdmin } from "@/lib/admin";
import { fail, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    requireAdmin(request);
    return NextResponse.json({ users: await listAccounts() });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    requireAdmin(request);
    const body = await readJson(request);
    const account = await createAccount(String(body.email || ""), String(body.password || ""));
    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
