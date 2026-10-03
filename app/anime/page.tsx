"use client";

import { AccountGate } from "@/components/account";
import { CatalogBoard } from "@/components/catalog-board";
import { useCopy } from "@/components/locale";

export default function AnimePage() {
  const copy = useCopy();
  return (
    <AccountGate>
      <CatalogBoard endpoint="/api/watch/anime" tab="anime" title={copy.anime} />
    </AccountGate>
  );
}
