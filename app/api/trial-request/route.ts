import { NextResponse } from "next/server";
import { notifyAdmin } from "@/lib/telegram";

export async function POST(request: Request) {
  let body: { email?: string; name?: string; note?: string };
  try {
    body = (await request.json()) as { email?: string; name?: string; note?: string };
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const name = (body.name || "").trim().slice(0, 80);
  const note = (body.note || "").trim().slice(0, 400);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  }

  try {
    await notifyAdmin(
      [
        "🎬 Demande essai Minuit (3 jours)",
        name ? `Nom : ${name}` : null,
        `Email : ${email}`,
        note ? `Note : ${note}` : null,
        "Rappel : 1 essai par appareil.",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  } catch {
    return NextResponse.json(
      { error: "Impossible d’envoyer la demande pour le moment" },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}
