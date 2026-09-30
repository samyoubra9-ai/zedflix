"use client";

import Link from "next/link";
import { useRef } from "react";
import type { MediaItem } from "@/lib/tmdb";
import { mediaHref } from "@/lib/tmdb";

export function MediaRow({
  id,
  title,
  items,
  seeAllHref,
}: {
  id: string;
  title: string;
  items: MediaItem[];
  seeAllHref?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  const scroll = (dir: -1 | 1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.85, 980), behavior: "smooth" });
  };

  return (
    <section id={id} className="group/row relative py-4">
      <div className="mb-3 flex items-end justify-between gap-3 px-4 sm:px-8 lg:px-12">
        <h2 className="min-w-0 flex-1 truncate text-lg font-medium tracking-tight text-white sm:text-xl">
          {title}
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          {seeAllHref ? (
            <Link
              href={seeAllHref}
              className="text-sm font-medium text-zinc-400 transition hover:text-white"
            >
              Voir tout
            </Link>
          ) : null}
          <div className="hidden gap-1 sm:flex">
            <button
              type="button"
              aria-label="Défiler à gauche"
              onClick={() => scroll(-1)}
              className="rounded-full border border-white/10 bg-black/40 p-2 text-zinc-300 opacity-0 transition group-hover/row:opacity-100 hover:bg-white/10 hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Défiler à droite"
              onClick={() => scroll(1)}
              className="rounded-full border border-white/10 bg-black/40 p-2 text-zinc-300 opacity-0 transition group-hover/row:opacity-100 hover:bg-white/10 hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scroller}
        className="scrollbar-none flex gap-2 overflow-x-auto px-4 pb-2 sm:gap-3 sm:px-8 lg:px-12"
      >
        {items.map((item) => (
          <Link
            key={`${id}-${item.mediaType}-${item.id}`}
            href={mediaHref(item)}
            className="group/card relative w-[42vw] max-w-[280px] shrink-0 sm:w-[30vw] md:w-[22vw] lg:w-[17vw]"
          >
            <div className="relative aspect-video overflow-hidden rounded-md bg-zinc-900 ring-1 ring-white/5 transition duration-300 group-hover/card:scale-[1.03] group-hover/card:ring-white/25">
              {item.backdrop || item.poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={(item.backdrop || item.poster)!}
                  alt={item.title || ""}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-zinc-600">
                  {item.title || "Sans titre"}
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent opacity-90" />
              {item.badge ? (
                <span className="absolute bottom-2 left-2 rounded bg-[#e50914] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  {item.badge}
                </span>
              ) : null}
              <div className="absolute inset-x-0 bottom-0 p-2.5">
                <p className="line-clamp-2 text-[13px] font-medium leading-snug text-white drop-shadow">
                  {item.title || ""}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
