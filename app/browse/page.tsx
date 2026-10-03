"use client";

import { AccountGate } from "@/components/account";
import { useCopy } from "@/components/locale";
import { CatalogBoard } from "@/components/catalog-board";
import { useTvMode } from "@/hooks/use-tv-mode";
import { TvBrowse } from "@/components/tv/tv-browse";

export default function BrowsePage() {
  return (
    <AccountGate>
      <BrowseSwitcher />
    </AccountGate>
  );
}

function BrowseSwitcher() {
  const tv = useTvMode();
  const copy = useCopy();
  if (tv) return <TvBrowse />;
  return <CatalogBoard endpoint="/api/watch/home" tab="stream" title={copy.films} resume />;
}
