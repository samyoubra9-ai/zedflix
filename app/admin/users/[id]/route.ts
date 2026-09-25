import { NextResponse } from "next/server";
import { deleteAccount } from "@/lib/accounts";
import { requireAdmin } from "@/lib/admin";
import { fail } from "@/lib/http";

export const runtime = "nodejs";

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
