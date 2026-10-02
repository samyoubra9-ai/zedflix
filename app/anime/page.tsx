"use client";

import { useState } from "react";
import { AccountGate } from "@/components/account";
import { CatalogBoard } from "@/components/catalog-board";
import { useOpenDetail } from "@/components/detail";
import type { Poster } from "@/components/posters";

export default function AnimePage() {
  return (
    <AccountGate>
      <AnimeHome />
    </AccountGate>
  );
}

function AnimeHome() {
  const openDetail = useOpenDetail();
  const [status, setStatus] = useState("");

  async function open(item: Poster) {
    setStatus("Vérification…");
    try {
      const response = await fetch(`/api/watch/search?q=${encodeURIComponent(item.title)}&match=1`, {
        signal: AbortSignal.timeout(8000),
      });
      const data = (await response.json()) as { result?: Poster; error?: string };
      if (!response.ok || !data.result?.id) {
        setStatus("Pas encore disponible à la lecture");
        return;
      }
      setStatus("");
      openDetail(data.result);
    } catch {
      setStatus("Pas encore disponible à la lecture");
    }
  }

  return (
    <>
      <CatalogBoard endpoint="/api/watch/anime" tab="anime" title="Animés" onOpen={open} />
      {status ? (
        <p className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-zinc-900 px-5 py-3 text-sm text-white ring-1 ring-white/15 md:bottom-8">
          {status}
        </p>
      ) : null}
    </>
  );
}
