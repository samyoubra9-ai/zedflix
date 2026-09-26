import { NextResponse } from "next/server";
import { deleteAccount, extendAccount, releaseDevice, setAdult } from "@/lib/accounts";
import { requireAdmin } from "@/lib/admin";
import { fail, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await context.params;
    const body = await readJson(request);
    if (body.releaseDevice === true) {
      return NextResponse.json(await releaseDevice(id));
    }
    if (typeof body.adult === "boolean") {
      return NextResponse.json(await setAdult(id, body.adult));
    }
    return NextResponse.json(await extendAccount(id, Number(body.months)));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await context.params;
    await deleteAccount(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
