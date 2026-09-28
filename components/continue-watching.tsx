"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listContinueWatching, watchHref, type WatchProgress } from "@/lib/watch-progress";
import { IconPlay } from "./icons";

export function ContinueWatching() {
  const [items, setItems] = useState<WatchProgress[]>([]);

  useEffect(() => {
    setItems(listContinueWatching());
    function refresh() {
      setItems(listContinueWatching());
    }
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  if (!items.length) return null;

  return (
    <section>
      <h2 className="mb-2.5 text-base font-semibold sm:mb-3 sm:text-xl">Continuer à regarder</h2>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const progress = item.duration > 0 ? (item.seconds / item.duration) * 100 : 0;
          return (
            <Link
              key={watchHref(item)}
              href={watchHref(item)}
              data-tv-focus
              className="tv-focus w-[68vw] max-w-[18rem] shrink-0 touch-manipulation outline-none sm:w-72"
            >
              <div className="relative aspect-video overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-white/5">
                {item.poster ? (
                  <img src={item.poster} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-zinc-900 text-zinc-600">
                    <IconPlay className="h-8 w-8" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-black">
                    <IconPlay className="h-5 w-5" />
                  </span>
                </div>
                <div className="absolute inset-x-0 bottom-0 p-2.5">
                  <p className="line-clamp-1 text-sm font-medium">{item.title}</p>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/20">
                    <div className="h-full rounded-full bg-[#e50914]" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
