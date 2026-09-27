"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listContinueWatching, type WatchProgress } from "@/lib/watch-progress";
import { watchHref } from "@/lib/tmdb";

export function ContinueWatching() {
  const [items, setItems] = useState<WatchProgress[]>([]);

  useEffect(() => {
    setItems(listContinueWatching());
  }, []);

  if (items.length === 0) return null;

  return (
    <section id="ma-liste" className="relative py-4">
      <div className="mb-3 px-4 sm:px-8 lg:px-12">
        <h2 className="text-lg font-medium tracking-tight text-white sm:text-xl">
          Continuer à regarder
        </h2>
      </div>
      <div className="scrollbar-none flex gap-2 overflow-x-auto px-4 pb-2 sm:gap-3 sm:px-8 lg:px-12">
        {items.map((item) => {
          const progress = item.duration > 0 ? (item.seconds / item.duration) * 100 : 0;
          return (
            <Link
              key={`${item.type}-${item.id}-${item.videoKey}`}
              href={watchHref(item, item.videoKey)}
              className="group relative w-[42vw] max-w-[280px] shrink-0 sm:w-[30vw] md:w-[22vw] lg:w-[17vw]"
            >
              <div className="relative aspect-video overflow-hidden rounded-md bg-zinc-900 ring-1 ring-white/5 transition group-hover:ring-white/25">
                {item.backdrop || item.poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={(item.backdrop || item.poster)!}
                    alt={item.title}
                    className="h-full w-full object-cover"
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
                  <span className="rounded-full bg-white/90 p-3 text-black shadow">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7L8 5z" />
                    </svg>
                  </span>
                </div>
                <div className="absolute inset-x-0 bottom-0 p-2.5">
                  <p className="line-clamp-1 text-[13px] font-medium text-white">{item.title}</p>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/20">
                    <div
                      className="h-full rounded-full bg-[#e50914]"
                      style={{ width: `${progress}%` }}
                    />
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
