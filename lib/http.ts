import { NextResponse } from "next/server";
import { AccountError } from "./accounts";

export async function readJson(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function fail(error: unknown) {
  if (error instanceof AccountError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
}
