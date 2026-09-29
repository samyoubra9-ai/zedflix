import { NextResponse } from "next/server";
import { getVitrineMedia } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getVitrineMedia();
    if (!data.backdrops.length && !data.posters.length) {
      return NextResponse.json({ error: "Visuels indisponibles" }, { status: 502 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Visuels indisponibles" }, { status: 502 });
  }
}
