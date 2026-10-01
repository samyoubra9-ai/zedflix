"use client";

import { useEffect, useState } from "react";
import { SiteNav, rememberCatalogTab, type CatalogTab } from "@/components/account";
import { ContinueWatching } from "@/components/continue-watching";
import { useOpenDetail } from "@/components/detail";
import { IconInfo, IconPlay } from "@/components/icons";
import { HeroSkeleton } from "@/components/loading";
import { MyListButton } from "@/components/my-list-button";
import { Poster, PosterRow } from "@/components/posters";

type HeroCard = Poster & { overview?: string; backdrop?: string };
type Row = { name: string; items: HeroCard[] };

export function CatalogBoard({
  endpoint,
  tab,
  title,
  resume = false,
  onOpen,
}: {
  endpoint: string;
  tab: CatalogTab;
  title: string;
  resume?: boolean;
  onOpen?: (item: Poster) => void;
}) {
  const [hero, setHero] = useState<HeroCard[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("");
  const openDetail = useOpenDetail();
  const open = onOpen || openDetail;

  useEffect(() => {
    rememberCatalogTab(tab);
  }, [tab]);

  useEffect(() => {
    let stop = false;
    fetch(endpoint)
      .then(async (response) => {
        const data = (await response.json()) as { hero?: HeroCard[]; rows?: Row[]; error?: string };
        if (stop) return;
        if (!response.ok) {
          setStatus(data.error || "Catalogue indisponible");
          setReady(true);
          return;
        }
        setHero(
          (data.hero || []).filter(
            (item) => item?.id && item.title && item.title !== "null" && (item.poster || item.backdrop),
          ),
        );
        setRows((data.rows || []).filter((row) => row.items?.length));
        setReady(true);
      })
      .catch(() => {
        if (!stop) {
          setStatus("Catalogue indisponible");
          setReady(true);
        }
      });
    return () => {
      stop = true;
    };
  }, [endpoint]);

  useEffect(() => {
    if (hero.length < 2) return;
    const timer = window.setInterval(() => {
      setFade(false);
      window.setTimeout(() => {
        setIndex((current) => (current + 1) % hero.length);
        setFade(true);
      }, 280);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [hero.length]);

  const featured = hero[index];

  return (
    <main className="min-h-screen bg-black pb-24 text-white md:pb-10">
      <SiteNav />
      {!ready ? <HeroSkeleton /> : null}

      {ready && featured ? (
        <section className="relative h-[52vh] min-h-[300px] sm:h-[68vh] sm:min-h-[440px] md:h-[78vh] md:min-h-[520px]">
          {hero.map((card, cardIndex) => (
            <img
              key={`${card.kind}-${card.id}`}
              src={card.backdrop || card.poster}
              alt=""
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
                cardIndex === index && fade ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-black/35" />
          <div
            className={`absolute inset-x-0 bottom-0 px-4 pb-20 pt-20 transition-opacity duration-500 sm:px-8 sm:pb-14 sm:pt-24 md:left-12 md:max-w-xl md:px-0 md:pb-16 ${
              fade ? "opacity-100" : "opacity-0"
            }`}
          >
            <p className="text-[11px] font-semibold tracking-[0.2em] text-zinc-300 sm:text-sm">{title}</p>
            <h1 className="mt-2 text-3xl font-bold leading-tight sm:mt-3 sm:text-5xl md:text-6xl">{featured.title}</h1>
            {featured.overview ? (
              <p className="mt-3 line-clamp-3 text-sm text-white/85 sm:mt-4 sm:text-lg">{featured.overview}</p>
            ) : null}
            <div className="mt-5 hidden flex-wrap items-center gap-3 sm:mt-6 sm:flex">
              <button
                type="button"
                onClick={() => open(featured)}
                className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-black sm:px-6 sm:py-3 sm:text-lg"
              >
                <IconPlay className="h-4 w-4 sm:h-5 sm:w-5" />
                Lecture
              </button>
              <button
                type="button"
                onClick={() => open(featured)}
                className="inline-flex items-center gap-2 rounded-md bg-white/20 px-5 py-2.5 text-sm font-semibold backdrop-blur hover:bg-white/30 sm:px-6 sm:py-3 sm:text-lg"
              >
                <IconInfo className="h-4 w-4 sm:h-5 sm:w-5" />
                Plus d’infos
              </button>
              {!onOpen ? <MyListButton item={featured} size="lg" /> : null}
            </div>
            {hero.length > 1 ? (
              <div className="mt-5 flex gap-2 sm:mt-6">
                {hero.map((card, dot) => (
                  <button
                    key={`dot-${card.kind}-${card.id}`}
                    type="button"
                    aria-label={`Affiche ${dot + 1}`}
                    onClick={() => {
                      setFade(false);
                      window.setTimeout(() => {
                        setIndex(dot);
                        setFade(true);
                      }, 220);
                    }}
                    className={`h-1 rounded-full transition-all ${dot === index ? "w-6 bg-white" : "w-3 bg-white/35"}`}
                  />
                ))}
              </div>
            ) : null}
          </div>
          <div className="absolute inset-x-0 bottom-0 z-20 flex gap-2 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
            <button
              type="button"
              onClick={() => open(featured)}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-white text-sm font-semibold text-black"
            >
              <IconPlay className="h-4 w-4" />
              Lecture
            </button>
            {!onOpen ? <MyListButton item={featured} /> : null}
          </div>
        </section>
      ) : null}

      {ready && !featured ? <div className="h-16 sm:h-24" /> : null}

      <div className="relative z-10 space-y-8 px-4 pb-6 sm:space-y-10 sm:px-8 md:px-12">
        {ready && resume ? <ContinueWatching /> : null}
        {rows.map((row) => (
          <section key={row.name}>
            <h2 className="mb-2.5 truncate text-base font-semibold sm:mb-3 sm:text-xl">{row.name}</h2>
            <PosterRow items={row.items} onOpen={onOpen} />
          </section>
        ))}
        {status ? <p className="text-sm text-zinc-300">{status}</p> : null}
      </div>
    </main>
  );
}
