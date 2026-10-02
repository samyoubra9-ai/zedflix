"use client";

import { useEffect, useState } from "react";

export type LiveChannel = { id: string; name: string; logo: string; url: string };
export type LiveGroup = { id: string; name: string; channels: LiveChannel[] };

const CACHE_KEY = "minuit_live_groups";
const CACHE_MS = 20 * 60 * 1000;

export function channelInitial(name: string) {
  const clean = name.normalize("NFD").replace(/\p{M}/gu, "").trim();
  const letter = clean.charAt(0).toLocaleUpperCase("fr");
  return /^[A-Z]$/.test(letter) ? letter : "";
}

export function channelLetters(name: string) {
  const clean = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\b(uhd|4k|fhd|hd|sd)\b/gi, " ")
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const mark = words
    .slice(0, 2)
    .map((word) => word.match(/[A-Za-z]/)?.[0]?.toLocaleUpperCase("fr") || "")
    .join("");
  if (mark) return mark;
  const one = clean.match(/[A-Za-z]/)?.[0]?.toLocaleUpperCase("fr");
  return one || "TV";
}

export function ChannelFace({ name, logo }: { name: string; logo: string }) {
  const [broken, setBroken] = useState(false);
  const missing = broken || !logo || logo.includes("clipartmax.com");
  if (missing) {
    return (
      <span className="flex h-full w-full items-center justify-center bg-black">
        <span className="flex h-[58%] w-[58%] items-center justify-center rounded-full bg-[#e50914] text-sm font-bold tracking-wide text-white">
          {channelLetters(name)}
        </span>
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo}
      alt=""
      loading="lazy"
      decoding="async"
      width={128}
      height={128}
      className="max-h-full max-w-full object-contain"
      onError={() => setBroken(true)}
    />
  );
}

function mergeKey(name: string) {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\b(uhd|4k|fhd|hd|sd)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function mergeLiveGroups(current: LiveGroup[], incoming: LiveGroup[]) {
  const groups = current.map((group) => ({ ...group, channels: [...group.channels] }));
  for (const group of incoming) {
    let target = groups.find((item) => item.id === group.id);
    if (!target) {
      target = { id: group.id, name: group.name, channels: [] };
      groups.push(target);
    }
    const byKey = new Map(target.channels.map((channel) => [mergeKey(channel.name), channel]));
    for (const channel of group.channels) {
      const key = mergeKey(channel.name);
      const previous = byKey.get(key);
      if (!previous) {
        byKey.set(key, channel);
        continue;
      }
      const previousMissing = !previous.logo || previous.logo.includes("clipartmax.com");
      const nextReal = Boolean(channel.logo) && !channel.logo.includes("clipartmax.com");
      if (previousMissing && nextReal) byKey.set(key, channel);
    }
    target.channels = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }
  return groups;
}

function readCache(): LiveGroup[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { at?: number; groups?: LiveGroup[] };
    if (!saved.at || Date.now() - saved.at > CACHE_MS || !saved.groups?.length) return null;
    return saved.groups;
  } catch {
    return null;
  }
}

function writeCache(groups: LiveGroup[]) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), groups }));
  } catch {
    // The list is still on screen if the browser refuses storage.
  }
}

export function useLiveGroups() {
  const [groups, setGroups] = useState<LiveGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filling, setFilling] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let stop = false;
    const cached = readCache();
    if (cached) {
      setGroups(cached);
      setLoading(false);
      return () => {
        stop = true;
      };
    }

    setFilling(true);
    (async () => {
      let cursor: string | null = null;
      let acc: LiveGroup[] = [];
      let first = true;
      try {
        do {
          const url = cursor
            ? `/api/watch/live?cursor=${encodeURIComponent(cursor)}`
            : "/api/watch/live";
          const response = await fetch(url);
          const data = (await response.json()) as {
            groups?: LiveGroup[];
            next?: string | null;
            error?: string;
          };
          if (stop) return;
          if (!response.ok) {
            if (first) {
              setStatus(data.error || "TV live indisponible");
              setGroups([]);
              setLoading(false);
            }
            setFilling(false);
            return;
          }
          acc = mergeLiveGroups(acc, data.groups || []);
          const hasChannels = acc.some((group) => group.channels.length > 0);
          if (hasChannels) {
            setGroups(acc);
            setLoading(false);
            first = false;
          }
          cursor = data.next ?? null;
        } while (cursor);
        if (stop) return;
        if (acc.some((group) => group.channels.length > 0)) writeCache(acc);
        setGroups(acc);
        setLoading(false);
        setFilling(false);
      } catch {
        if (!stop && first) {
          setStatus("TV live indisponible");
          setGroups([]);
          setLoading(false);
        }
        setFilling(false);
      }
    })();

    return () => {
      stop = true;
    };
  }, []);

  return { groups, loading, filling, status };
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function LetterBar({
  present,
  selected,
  filling,
  onSelect,
  compact = false,
}: {
  present: Set<string>;
  selected: string;
  filling: boolean;
  onSelect: (letter: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <LetterChip
        label="A–Z"
        active={selected === "all"}
        disabled={false}
        dim={false}
        compact={compact}
        onClick={() => onSelect("all")}
      />
      {LETTERS.map((letter) => {
        const has = present.has(letter);
        return (
          <LetterChip
            key={letter}
            label={letter}
            active={selected === letter}
            disabled={!filling && !has}
            dim={!has}
            compact={compact}
            onClick={() => onSelect(letter)}
          />
        );
      })}
    </div>
  );
}

function LetterChip({
  label,
  active,
  disabled,
  dim,
  compact,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  dim: boolean;
  compact: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-tv-focus
      disabled={disabled}
      onClick={onClick}
      className={`tv-focus shrink-0 rounded-full font-semibold outline-none ring-1 transition disabled:cursor-default ${
        compact ? "min-w-[2.5rem] px-3 py-2 text-sm" : "min-w-[2.25rem] px-3 py-2 text-xs sm:text-sm"
      } ${
        active
          ? "bg-[#e50914] text-white ring-[#e50914]"
          : "bg-white/10 text-zinc-200 ring-white/10"
      } ${dim && !active ? "opacity-35" : ""}`}
    >
      {label}
    </button>
  );
}
