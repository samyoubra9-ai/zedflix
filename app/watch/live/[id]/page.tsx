"use client";

import { useParams } from "next/navigation";
import { AccountGate } from "@/components/account";
import { Player } from "@/components/player";

export default function WatchLivePage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id || "");
  return (
    <AccountGate player>
      <Player id={id} live back="/tv" />
    </AccountGate>
  );
}
