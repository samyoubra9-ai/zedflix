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
    setStatus("");
    try {
      const response = await fetch(`/api/watch/search?q=${encodeURIComponent(item.title)}&match=1`, {
        signal: AbortSignal.timeout(8000),
      });
      const data = (await response.json()) as { result?: Poster; error?: string };
      if (!response.ok || !data.result?.id) {
        setStatus("Pas encore disponible à la lecture");
        return;
      }
      openDetail(data.result);
    } catch {
      setStatus("Pas encore disponible à la lecture");
    }
  }

  return (
    <>
      <CatalogBoard endpoint="/api/watch/anime" tab="anime" title="Animés" onOpen={open} />
      {status ? (
        <p className="fixed inset-x-0 bottom-24 z-50 px-4 text-center text-sm text-zinc-200 md:bottom-8">{status}</p>
      ) : null}
    </>
  );
}
