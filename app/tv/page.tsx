"use client";

import { useEffect, useMemo, useState } from "react";
import { AccountGate, SiteNav } from "@/components/account";
import { armLiveSound, LiveStage } from "@/components/live-stage";
import { TvLiveBrowse } from "@/components/tv/tv-live";
import { useTvMode } from "@/hooks/use-tv-mode";

type Channel = { id: string; name: string; logo: string; url: string };
type Group = { id: string; name: string; channels: Channel[] };

export default function TvPage() {
  return (
    <AccountGate>
      <TvPageBody />
    </AccountGate>
  );
}

function TvPageBody() {
  const tv = useTvMode();
  if (tv) return <TvLiveBrowse />;
  return <MobileLive />;
}

function MobileLive() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [activeGroup, setActiveGroup] = useState<string>("all");
  const [channelId, setChannelId] = useState<string | null>(null);

  function openChannel(id: string) {
    armLiveSound();
    setChannelId(id);
  }

  useEffect(() => {
    let stop = false;
    setLoading(true);
    setStatus("");
    fetch("/api/watch/live")
      .then(async (response) => {
        const data = (await response.json()) as { groups?: Group[]; error?: string };
        if (stop) return;
        if (!response.ok) {
          setStatus(data.error || "TV live indisponible");
          setGroups([]);
          setLoading(false);
          return;
        }
        setGroups(data.groups || []);
        setLoading(false);
      })
      .catch(() => {
        if (!stop) {
          setStatus("TV live indisponible");
          setGroups([]);
          setLoading(false);
        }
      });
    return () => {
      stop = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .filter((group) => activeGroup === "all" || group.id === activeGroup)
      .map((group) => ({
        ...group,
        channels: group.channels.filter((channel) =>
          q ? channel.name.toLowerCase().includes(q) : true,
        ),
      }))
      .filter((group) => group.channels.length > 0);
  }, [groups, query, activeGroup]);

  const total = filtered.reduce((sum, group) => sum + group.channels.length, 0);

  return (
    <>
    <main
      data-live-paused={channelId ? "" : undefined}
      className="min-h-screen bg-black px-4 pb-28 pt-20 text-white sm:px-8 sm:pb-16 sm:pt-24 md:px-12"
    >
      <SiteNav />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.22em] text-[#e50914]">
            <span className="tv-live-dot h-1.5 w-1.5 rounded-full bg-[#e50914]" />
            DIRECT
          </p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">TV en direct</h1>
          <p className="mt-2 text-sm text-zinc-400">
            {loading ? "Chargement des chaînes…" : `${total} chaîne${total > 1 ? "s" : ""}`}
          </p>
        </div>

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher une chaîne"
          className="h-11 w-full rounded-xl bg-white/5 px-4 text-sm outline-none ring-1 ring-white/10 placeholder:text-zinc-500 focus:ring-[#e50914]/60 sm:max-w-md"
        />
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setActiveGroup("all")}
          className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-medium ring-1 transition sm:text-sm ${
            activeGroup === "all"
              ? "bg-[#e50914] text-white ring-[#e50914]"
              : "bg-white/10 text-zinc-300 ring-white/10 hover:bg-white/15"
          }`}
        >
          Toutes
        </button>
        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => setActiveGroup(group.id)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-medium ring-1 transition sm:text-sm ${
              activeGroup === group.id
                ? "bg-[#e50914] text-white ring-[#e50914]"
                : "bg-white/10 text-zinc-300 ring-white/10 hover:bg-white/15"
            }`}
          >
            {group.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-10 flex justify-center">
          <span className="inline-block h-10 w-10 animate-spin rounded-full border-[3px] border-white/10 border-t-[#e50914]" />
        </div>
      ) : null}

      {status ? <p className="mt-8 text-sm text-zinc-300">{status}</p> : null}

      <div className="mt-8 space-y-10">
        {filtered.map((group) => (
          <section key={group.id}>
            <h2 className="mb-4 text-lg font-semibold sm:text-xl">{group.name}</h2>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-6 lg:grid-cols-8">
              {group.channels.map((channel) => (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => openChannel(channel.id)}
                  className="group rounded-xl bg-white/5 p-2.5 text-center ring-1 ring-white/10 transition hover:bg-white/10 hover:ring-white/25"
                >
                  <span className="mx-auto flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-zinc-950/80 p-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={channel.logo}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      width={96}
                      height={96}
                      className="max-h-full max-w-full object-contain"
                    />
                  </span>
                  <span className="mt-2 block line-clamp-2 text-[11px] font-medium leading-snug text-zinc-200 sm:text-xs">
                    {channel.name}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {!loading && !status && !filtered.length ? (
        <p className="mt-10 rounded-xl bg-white/5 px-4 py-8 text-center text-zinc-400 ring-1 ring-white/10">
          Aucune chaîne ne correspond à ta recherche.
        </p>
      ) : null}
    </main>
    {channelId ? <LiveStage id={channelId} onClose={() => setChannelId(null)} /> : null}
    </>
  );
}
