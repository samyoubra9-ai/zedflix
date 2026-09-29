"use client";

import { useEffect, useRef, useState } from "react";
import { IconPlay } from "./icons";
import { MyListButton } from "./my-list-button";
import { useOpenDetail } from "./detail";
import { useTvMode } from "@/hooks/use-tv-mode";

export type Poster = {
  id: string;
  title: string;
  poster: string;
  kind: "movie" | "show";
};

export function PosterCard({
  item,
  autofocus = false,
}: {
  item: Poster;
  autofocus?: boolean;
}) {
  const open = useOpenDetail();
  const tv = useTvMode();
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (autofocus && tv) ref.current?.focus({ preventScroll: true });
  }, [autofocus, tv]);

  return (
    <div className="group/card relative z-0 w-full transition duration-200 ease-out will-change-transform md:hover:z-30 md:hover:scale-[1.12] md:hover:shadow-[0_20px_45px_rgba(0,0,0,0.7)]">
      <button
        ref={ref}
        type="button"
        onClick={() => open(item)}
        data-tv-focus
        {...(autofocus ? { "data-tv-autofocus": true } : {})}
        className="tv-focus relative block w-full touch-manipulation rounded-lg text-left outline-none"
      >
        <span className="relative block aspect-[2/3] overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-white/5 transition duration-200 md:group-hover/card:ring-2 md:group-hover/card:ring-white/30">
          {!loaded ? <span className="absolute inset-0 skeleton" /> : null}
          {item.poster ? (
            <img
              src={item.poster}
              alt=""
              loading="lazy"
              decoding="async"
              onLoad={() => setLoaded(true)}
              className={`h-full w-full object-cover transition duration-300 ${
                loaded ? "opacity-100" : "opacity-0"
              } md:group-hover/card:scale-105 md:group-hover/card:brightness-[0.7]`}
            />
          ) : (
            <span className="flex h-full items-center justify-center px-2 text-center text-xs text-zinc-500">
              {item.title}
            </span>
          )}

          <span className="pointer-events-none absolute inset-0 hidden flex-col justify-end bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 transition duration-200 md:flex md:group-hover/card:opacity-100">
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-white text-black shadow-lg">
                <IconPlay className="h-5 w-5" />
              </span>
            </span>
            <span className="relative space-y-1.5 p-2.5 pt-8">
              <span className="block line-clamp-2 text-xs font-semibold leading-snug text-white">
                {item.title}
              </span>
              <span className="flex items-center gap-2">
                <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-200">
                  {item.kind === "show" ? "SÉRIE" : "FILM"}
                </span>
                <span className="ml-auto flex h-6 w-6 items-center justify-center rounded-full border border-white/35 text-[10px] text-white">
                  ▾
                </span>
              </span>
            </span>
          </span>
        </span>

        <span className="mt-1.5 block truncate text-[11px] leading-tight text-zinc-300 transition duration-200 md:group-hover/card:opacity-0 sm:mt-2 sm:text-sm">
          {item.title}
        </span>
      </button>

      {!tv ? (
        <div className="absolute right-2 top-2 z-20 hidden opacity-0 transition duration-200 md:block md:group-hover/card:opacity-100">
          <MyListButton item={item} size="sm" />
        </div>
      ) : null}
    </div>
  );
}

export function PosterRow({ items }: { items: Poster[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const tv = useTvMode();

  function move(direction: number) {
    const node = scroller.current;
    if (!node) return;
    node.scrollBy({ left: direction * Math.round(node.clientWidth * 0.8), behavior: "smooth" });
  }

  return (
    <div className="group relative -mx-4 px-4 sm:mx-0 sm:px-0">
      {!tv ? (
        <button
          type="button"
          aria-label="Défiler à gauche"
          onClick={() => move(-1)}
          className="absolute left-0 top-[38%] z-40 hidden h-14 w-9 -translate-y-1/2 items-center justify-center rounded-r bg-black/70 text-2xl md:flex"
        >
          ‹
        </button>
      ) : null}
      <div
        ref={scroller}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-smooth py-4 [-webkit-overflow-scrolling:touch] [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-3.5 sm:py-6 md:py-7 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, index) => (
          <div
            key={`${item.kind}-${item.id}-${item.title}`}
            className="w-[38vw] max-w-[11rem] min-w-[7.5rem] shrink-0 snap-start sm:w-40 sm:max-w-none sm:min-w-0"
          >
            <PosterCard item={item} autofocus={tv && index === 0} />
          </div>
        ))}
      </div>
      {!tv ? (
        <button
          type="button"
          aria-label="Défiler à droite"
          onClick={() => move(1)}
          className="absolute right-0 top-[38%] z-40 hidden h-14 w-9 -translate-y-1/2 items-center justify-center rounded-l bg-black/70 text-2xl md:flex"
        >
          ›
        </button>
      ) : null}
    </div>
  );
}

export function PosterGrid({ items }: { items: Poster[] }) {
  const tv = useTvMode();
  return (
    <div
      data-tv-zone="content"
      className={`grid gap-2.5 py-2 sm:gap-4 sm:py-4 ${
        tv ? "grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7" : "grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
      }`}
    >
      {items.map((item, index) => (
        <PosterCard
          key={`${item.kind}-${item.id}-${item.title}`}
          item={item}
          autofocus={tv && index === 0}
        />
      ))}
    </div>
  );
}
