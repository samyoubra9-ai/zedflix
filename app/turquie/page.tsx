"use client";

import { AccountGate } from "@/components/account";
import { CatalogBoard } from "@/components/catalog-board";
import { useCopy } from "@/components/locale";

export default function TurkeyPage() {
  const copy = useCopy();
  return (
    <AccountGate>
      <CatalogBoard endpoint="/api/watch/turk" tab="turkey" title={copy.turkey} />
    </AccountGate>
  );
}
