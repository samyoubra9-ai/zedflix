"use client";

import { useParams } from "next/navigation";
import { AccountGate } from "@/components/account";
import { Player } from "@/components/player";

export default function WatchMoviePage() {
  const params = useParams<{ id: string }>();
  return (
    <AccountGate player>
      <Player id={params.id} back={params.id.startsWith("m-") || params.id.startsWith("a-") ? "/anime" : params.id.startsWith("en-") ? "/browse" : `/films/${params.id}`} />
    </AccountGate>
  );
}
