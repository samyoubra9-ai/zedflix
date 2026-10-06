"use client";

import { useParams } from "next/navigation";
import { AccountGate } from "@/components/account";
import { Player } from "@/components/player";

export default function WatchEpisodePage() {
  const params = useParams<{ id: string; episode: string }>();
  const episode = Number(params.episode);
  return (
    <AccountGate player>
      <Player id={params.id} episode={episode} back={params.id.startsWith("tr-") ? "/turquie" : params.id.startsWith("m-") || params.id.startsWith("a-") ? "/anime" : params.id.startsWith("en-") ? "/browse" : `/series/${params.id}`} />
    </AccountGate>
  );
}
