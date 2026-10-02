"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { rememberCatalogTab } from "@/components/account";
import { armLiveSound, LiveStage } from "@/components/live-stage";
import { channelInitial, LetterBar, useLiveGroups, type LiveChannel } from "@/components/tv/live-catalog";

/** Leanback-style live TV grid — built for D-pad / remote. */
export function TvLiveBrowse() {
  const { groups, loading, filling, status } = useLiveGroups();
  const [activeGroup, setActiveGroup] = useState("all");
  const [letter, setLetter] = useState("all");
  const [channelId, setChannelId] = useState<string | null>(null);
  const chipsRef = useRef<HTMLDivElement>(null);

  function openChannel(id: string) {
    armLiveSound();
    setChannelId(id);
  }

  useEffect(() => {
    rememberCatalogTab("live");
  }, []);

  const matched = useMemo(() => {
    return groups
      .filter((group) => activeGroup === "all" || group.id === activeGroup)
      .filter((group) => group.channels.length > 0);
  }, [groups, activeGroup]);

  const present = useMemo(() => {
    const letters = new Set<string>();
    for (const group of matched) {
      for (const channel of group.channels) {
        const initial = channelInitial(channel.name);
        if (initial) letters.add(initial);
      }
    }
    return letters;
  }, [matched]);

  const filtered = useMemo(() => {
    if (letter === "all") return matched;
    return matched
      .map((group) => ({
        ...group,
        channels: group.channels.filter((channel) => channelInitial(channel.name) === letter),
      }))
      .filter((group) => group.channels.length > 0);
  }, [matched, letter]);

  const total = filtered.reduce((sum, group) => sum + group.channels.length, 0);
  const flat = useMemo(() => filtered.flatMap((group) => group.channels), [filtered]);

  useEffect(() => {
    const focused = chipsRef.current?.querySelector<HTMLElement>(":focus");
    focused?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activeGroup, letter]);

  return (
    <>
    <main
      data-tv-zone="content"
      data-live-paused={channelId ? "" : undefined}
      className="relative min-h-screen bg-[#050505] pb-20 text-white"
    >
      <header className="relative overflow-hidden px-10 pb-6 pt-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(229,9,20,0.22),transparent_55%)]" />
        <div className="relative flex items-end justify-between gap-6">
          <div>
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.28em] text-[#e50914]">
              <span className="tv-live-dot h-2 w-2 rounded-full bg-[#e50914]" />
              EN DIRECT
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight xl:text-5xl">TV Live</h1>
            <p className="mt-2 text-base text-zinc-400">
              {loading
                ? "Chargement des chaînes…"
                : `${total} chaîne${total > 1 ? "s" : ""}${filling ? " · chargement…" : ""}`}
            </p>
          </div>
          {!loading && flat[0] ? (
            <button
              type="button"
              onClick={() => openChannel(flat[0].id)}
              data-tv-focus
              className="tv-focus hidden shrink-0 items-center gap-3 rounded-xl bg-white px-6 py-4 text-base font-semibold text-black outline-none lg:inline-flex"
            >
              Regarder {flat[0].name}
            </button>
          ) : null}
        </div>
      </header>

      <div data-tv-zone="filters" className="space-y-3 px-10">
        <div
          ref={chipsRef}
          className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <Chip
            label="Toutes"
            active={activeGroup === "all"}
            onClick={() => {
              setActiveGroup("all");
              setLetter("all");
            }}
          />
          {groups.map((group) => (
            <Chip
              key={group.id}
              label={group.name}
              active={activeGroup === group.id}
              onClick={() => {
                setActiveGroup(group.id);
                setLetter("all");
              }}
            />
          ))}
        </div>

        <LetterBar
          present={present}
          selected={letter}
          filling={filling}
          compact
          onSelect={setLetter}
        />
      </div>

      {loading ? (
        <div className="flex h-[40vh] items-center justify-center">
          <span className="inline-block h-12 w-12 animate-spin rounded-full border-[3px] border-white/10 border-t-[#e50914]" />
        </div>
      ) : null}

      {status ? <p className="px-10 pt-8 text-base text-zinc-300">{status}</p> : null}

      <div data-tv-zone="content" className="mt-8 space-y-10">
        {filtered.map((group, groupIndex) => (
          <section key={group.id}>
            <h2 className="mb-4 px-10 text-xl font-bold tracking-wide">{group.name}</h2>
            <div className="grid grid-cols-5 gap-4 px-10 xl:grid-cols-6 2xl:grid-cols-7">
              {group.channels.map((channel, index) => (
                <ChannelTile
                  key={channel.id}
                  channel={channel}
                  autofocus={groupIndex === 0 && index === 0}
                  onOpen={() => openChannel(channel.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {!loading && filling && !filtered.length ? (
        <div className="flex h-24 items-center justify-center">
          <span className="inline-block h-10 w-10 animate-spin rounded-full border-[3px] border-white/10 border-t-[#e50914]" />
        </div>
      ) : null}

      {!loading && !filling && !status && !filtered.length ? (
        <p className="mx-10 mt-10 rounded-2xl bg-white/5 px-6 py-10 text-center text-zinc-400 ring-1 ring-white/10">
          Aucune chaîne dans ce filtre.
        </p>
      ) : null}
    </main>
    {channelId ? <LiveStage id={channelId} onClose={() => setChannelId(null)} /> : null}
    </>
  );
}

function Chip({
  label,
  active,
  onClick,
  compact = false,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      data-tv-focus
      onClick={onClick}
      className={`tv-focus shrink-0 rounded-full font-semibold outline-none ring-1 transition ${
        compact ? "min-w-[2.5rem] px-3 py-2 text-sm" : "px-5 py-3 text-sm"
      } ${
        active
          ? "bg-[#e50914] text-white ring-[#e50914]"
          : "bg-white/8 text-zinc-200 ring-white/10"
      }`}
    >
      {label}
    </button>
  );
}

function ChannelTile({
  channel,
  autofocus,
  onOpen,
}: {
  channel: LiveChannel;
  autofocus?: boolean;
  onOpen: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (autofocus) ref.current?.focus({ preventScroll: true });
  }, [autofocus]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      data-tv-focus
      data-tv-autofocus={autofocus ? true : undefined}
      tabIndex={0}
      className="tv-focus tv-channel group flex flex-col rounded-2xl bg-white/[0.04] p-3 text-center outline-none ring-1 ring-white/10"
    >
      <span className="mx-auto flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-zinc-950/90 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={channel.logo}
          alt=""
          loading="lazy"
          decoding="async"
          width={128}
          height={128}
          className="max-h-full max-w-full object-contain transition duration-150 group-focus:scale-105"
        />
      </span>
      <span className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-zinc-100">
        {channel.name}
      </span>
    </button>
  );
}
