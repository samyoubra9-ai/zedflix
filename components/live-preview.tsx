"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Channel = { id: string; name: string; logo: string };
type Group = { id: string; name: string; channels: Channel[] };

/** Home Live preview rows + see-all CTA (same idea as Android Live home). */
export function LivePreviewRows({ tv = false }: { tv?: boolean }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stop = false;
    fetch("/api/watch/live")
      .then(async (response) => {
        const data = (await response.json()) as { groups?: Group[] };
        if (stop || !response.ok) return;
        setGroups(data.groups || []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!stop) setReady(true);
      });
    return () => {
      stop = true;
    };
  }, []);

  if (!ready || !groups.length) return null;

  const all = groups.flatMap((group) => group.channels);
  const previewGroups: Group[] = [
    { id: "all", name: "Toutes les chaînes", channels: all.slice(0, 36) },
    ...groups.map((group) => ({
      ...group,
      channels: group.channels.slice(0, 24),
    })),
  ].filter((group) => group.channels.length > 0);

  return (
    <div className={tv ? "space-y-8" : "space-y-8"}>
      <div className={tv ? "px-10" : ""}>
        <Link
          href="/tv"
          {...(tv ? { "data-tv-focus": true } : {})}
          className={
            tv
              ? "tv-focus inline-flex items-center gap-2 rounded-full bg-[#e50914] px-5 py-3 text-sm font-semibold text-white outline-none"
              : "inline-flex items-center gap-2 rounded-full bg-[#e50914] px-3.5 py-2 text-xs font-semibold text-white sm:text-sm"
          }
        >
          <span className="tv-live-dot h-1.5 w-1.5 rounded-full bg-white" />
          Voir toutes les chaînes
        </Link>
      </div>

      {previewGroups.map((group) => (
        <section key={group.id}>
          <div
            className={`mb-2.5 flex items-end justify-between gap-3 sm:mb-3 ${
              tv ? "px-10" : ""
            }`}
          >
            <h2 className={`font-semibold ${tv ? "text-xl" : "text-base sm:text-xl"}`}>
              {group.name}
            </h2>
            <Link
              href="/tv"
              {...(tv ? { "data-tv-focus": true } : {})}
              className={`shrink-0 text-sm text-zinc-400 hover:text-white ${
                tv ? "tv-focus rounded-md px-2 py-1 outline-none" : ""
              }`}
            >
              Voir tout
            </Link>
          </div>
          <div
            className={`flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
              tv ? "gap-4 px-10" : ""
            }`}
          >
            {group.channels.map((channel, index) => (
              <Link
                key={`${group.id}-${channel.id}`}
                href={`/watch/live/${encodeURIComponent(channel.id)}`}
                {...(tv
                  ? {
                      "data-tv-focus": true,
                      ...(group.id === "all" && index === 0
                        ? { "data-tv-autofocus": true }
                        : {}),
                    }
                  : {})}
                className={`group shrink-0 rounded-xl bg-white/5 p-2 text-center ring-1 ring-white/10 transition hover:bg-white/10 hover:ring-white/25 ${
                  tv
                    ? "tv-focus w-[7.5rem] outline-none sm:w-[8.5rem]"
                    : "w-[4.75rem] sm:w-[5.5rem]"
                }`}
              >
                <span className="mx-auto flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-zinc-950/80 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={channel.logo}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width={96}
                    height={96}
                    className="max-h-full max-w-full object-contain transition group-hover:scale-105"
                  />
                </span>
                <span className="mt-1.5 block line-clamp-2 text-[10px] font-medium leading-snug text-zinc-200 sm:text-[11px]">
                  {channel.name}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
