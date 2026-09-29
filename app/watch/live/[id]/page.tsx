"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { AccountGate } from "@/components/account";
import { Player } from "@/components/player";

export default function WatchLivePage() {
  return (
    <Suspense>
      <WatchLiveInner />
    </Suspense>
  );
}

function WatchLiveInner() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const id = decodeURIComponent(params.id || "");
  const saver = search.get("saver") === "1";
  return (
    <AccountGate player>
      <Player id={id} live saver={saver} back="/tv" />
    </AccountGate>
  );
}
