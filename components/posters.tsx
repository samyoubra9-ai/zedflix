"use client";

import { useRef, useState } from "react";
import { useOpenDetail } from "./detail";

export type Poster = {
  id: string;
  title: string;
  poster: string;
  kind: "movie" | "show";
};

export function PosterCard({ item }: { item: Poster }) {
  const open = useOpenDetail();
  const [loaded, setLoaded] = useState(false);
  return (
    <button type="button" onClick={() => open(item)} className="w-full text-left">
      <span className="relative block aspect-[2/3] overflow-hidden rounded-md bg-zinc-900 shadow-lg transition duration-200 hover:scale-105 hover:ring-2 hover:ring-white">
        {!loaded ? <span className="absolute inset-0 skeleton" /> : null}
        <img
          src={item.poster}
          alt=""
          onLoad={() => setLoaded(true)}
          className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      </span>
      <span className="mt-2 block truncate text-sm text-zinc-200">{item.title}</span>
    </button>
  );
}

export function PosterRow({ items }: { items: Poster[] }) {
  const scroller = useRef<HTMLDivElement>(null);

  function move(direction: number) {
    const node = scroller.current;
    if (!node) return;
    node.scrollBy({ left: direction * Math.round(node.clientWidth * 0.85), behavior: "smooth" });
  }

  return (
    <div className="group relative">
      <button
        type="button"
        aria-label="Défiler à gauche"
        onClick={() => move(-1)}
        className="absolute left-0 top-[38%] z-10 hidden h-16 w-10 -translate-y-1/2 items-center justify-center rounded-r bg-black/70 text-2xl md:flex"
      >
        ‹
      </button>
      <div ref={scroller} className="flex gap-3 overflow-x-auto scroll-smooth pb-3 [scrollbar-width:none]">
        {items.map((item) => (
          <div key={`${item.kind}-${item.id}`} className="w-36 shrink-0 sm:w-44">
            <PosterCard item={item} />
          </div>
        ))}
      </div>
      <button
        type="button"
        aria-label="Défiler à droite"
        onClick={() => move(1)}
        className="absolute right-0 top-[38%] z-10 hidden h-16 w-10 -translate-y-1/2 items-center justify-center rounded-l bg-black/70 text-2xl md:flex"
      >
        ›
      </button>
    </div>
  );
}

export function PosterGrid({ items }: { items: Poster[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {items.map((item) => (
        <PosterCard key={`${item.kind}-${item.id}-${item.title}`} item={item} />
      ))}
    </div>
  );
}
