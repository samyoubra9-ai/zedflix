"use client";

import { AccountGate } from "@/components/account";
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
  if (tv) return <TvBrowse />;
  return <CatalogBoard endpoint="/api/watch/home" tab="stream" title="Films & Séries" resume />;
}
