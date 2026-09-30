"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/components/account";
import { ContinueWatching } from "@/components/continue-watching";
import { useOpenDetail } from "@/components/detail";
import { IconInfo, IconPlay } from "@/components/icons";
import { MyListButton } from "@/components/my-list-button";
import type { Poster } from "@/components/posters";
import { LivePreviewRows } from "@/components/live-preview";

type HeroCard = Poster & { overview: string; backdrop: string };
type Row = { name: string; items: HeroCard[] };

function TvPoster({
  item,
  large = false,
  autoFocus = false,
}: {
  item: Poster;
  large?: boolean;
  autoFocus?: boolean;
}) {
  const open = useOpenDetail();
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  return (
    <button
      ref={ref}
      type="button"
      data-tv-focus
      onClick={() => open(item)}
      className={`tv-focus group relative shrink-0 overflow-hidden rounded-lg bg-zinc-900 text-left outline-none ring-1 ring-white/10 transition duration-150 ${
        large ? "w-[11.5rem]" : "w-[9.75rem]"
      }`}
    >
      <span className="relative block aspect-[2/3] overflow-hidden">
        {item.poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.poster}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition duration-200 group-focus:scale-105 group-focus:brightness-110"
          />
        ) : (
          <span className="flex h-full items-center justify-center px-2 text-center text-xs text-zinc-500">
            {item.title}
          </span>
        )}
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition group-focus:opacity-100" />
        <span className="pointer-events-none absolute bottom-2 left-2 right-2 line-clamp-2 text-xs font-semibold opacity-0 transition group-focus:opacity-100">
          {item.title}
        </span>
      </span>
    </button>
  );
}

function TvRow({ title, items, first = false }: { title: string; items: Poster[]; first?: boolean }) {
  if (!items.length) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-3 px-10 text-xl font-bold tracking-wide text-white">{title}</h2>
      <div className="flex gap-4 overflow-x-auto px-10 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item, index) => (
          <TvPoster
            key={`${item.kind}-${item.id}-${item.title}`}
            item={item}
            autoFocus={first && index === 0}
          />
        ))}
      </div>
    </section>
  );
}

/** Leanback-style home matching the Android TV APK feel. */
export function TvBrowse() {
  const { profile } = useSession();
  const allowLive = profile?.catalogAccess !== "vod";
  const [hero, setHero] = useState<HeroCard[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const openDetail = useOpenDetail();

  useEffect(() => {
    let stop = false;
    fetch("/api/watch/home")
      .then(async (response) => {
        const data = (await response.json()) as { hero?: HeroCard[]; rows?: Row[]; error?: string };
        if (stop) return;
        if (!response.ok) {
          setStatus(data.error || "L’accueil est indisponible");
          setLoading(false);
          return;
        }
        setHero(data.hero || []);
        setRows(data.rows || []);
        setLoading(false);
      })
      .catch(() => {
        if (!stop) {
          setStatus("L’accueil est indisponible");
          setLoading(false);
        }
      });
    return () => {
      stop = true;
    };
  }, []);

  useEffect(() => {
    if (hero.length < 2) return;
    const timer = window.setInterval(() => {
      setFade(false);
      window.setTimeout(() => {
        setIndex((current) => (current + 1) % hero.length);
        setFade(true);
      }, 260);
    }, 9000);
    return () => window.clearInterval(timer);
  }, [hero.length]);

  const featured = hero[index];
  const flatRows = useMemo(() => rows.filter((row) => row.items.length > 0), [rows]);

  return (
    <main className="relative min-h-screen bg-[#050505] pb-16 text-white">
      {loading ? (
        <div className="flex h-[70vh] items-center justify-center">
          <span className="inline-block h-12 w-12 animate-spin rounded-full border-[3px] border-white/10 border-t-[#e50914]" />
        </div>
      ) : null}

      {!loading && featured ? (
        <section className="relative h-[72vh] min-h-[28rem] w-full overflow-hidden">
          {hero.map((card, cardIndex) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${card.kind}-${card.id}`}
              src={card.backdrop || card.poster}
              alt=""
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
                cardIndex === index && fade ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-black/20 to-black/40" />

          <div
            className={`absolute bottom-0 left-0 max-w-3xl px-10 pb-16 pt-24 transition-opacity duration-500 ${
              fade ? "opacity-100" : "opacity-0"
            }`}
          >
            <p className="text-xs font-semibold tracking-[0.28em] text-[#e50914]">
              {featured.kind === "show" ? "SÉRIE" : "FILM"}
            </p>
            <h1 className="mt-3 text-5xl font-bold leading-[1.05] tracking-tight xl:text-6xl">
              {featured.title}
            </h1>
            {featured.overview ? (
              <p className="mt-4 line-clamp-3 max-w-xl text-base leading-relaxed text-white/80">
                {featured.overview}
              </p>
            ) : null}

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                data-tv-focus
                onClick={() => openDetail(featured)}
                className="tv-focus inline-flex items-center gap-2 rounded-md bg-white px-7 py-3.5 text-base font-semibold text-black outline-none"
              >
                <IconPlay className="h-5 w-5" />
                Lecture
              </button>
              <button
                type="button"
                data-tv-focus
                onClick={() => openDetail(featured)}
                className="tv-focus inline-flex items-center gap-2 rounded-md bg-white/15 px-7 py-3.5 text-base font-semibold outline-none ring-1 ring-white/15"
              >
                <IconInfo className="h-5 w-5" />
                Plus d’infos
              </button>
              <span className="tv-focus-wrap inline-flex">
                <MyListButton item={featured} size="lg" />
              </span>
            </div>
          </div>
        </section>
      ) : null}

      <div className={`relative z-10 ${featured ? "-mt-6" : "pt-10"}`}>
        {!loading && allowLive ? (
          <div className="mb-8 px-10">
            <Link
              href="/tv"
              data-tv-focus
              className="tv-focus group relative flex min-h-[7.5rem] w-full items-stretch overflow-hidden rounded-2xl outline-none ring-1 ring-white/10"
            >
              <span className="absolute inset-0 bg-[linear-gradient(110deg,#e50914_0%,#7f0b12_42%,#141414_100%)]" />
              <span className="absolute inset-0 bg-[radial-gradient(circle_at_right,rgba(255,255,255,0.16),transparent_45%)]" />
              <span className="relative flex flex-1 items-center justify-between gap-4 px-7 py-5">
                <span>
                  <span className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.28em] text-white/90">
                    <span className="tv-live-dot h-2 w-2 rounded-full bg-white" />
                    EN DIRECT
                  </span>
                  <span className="mt-2 block text-2xl font-bold">Toutes les chaînes</span>
                  <span className="mt-1 block text-sm text-white/75">
                    Catalogue FR complet · télécommande OK
                  </span>
                </span>
                <span className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black">
                  Voir tout
                </span>
              </span>
            </Link>
          </div>
        ) : null}

        {!loading ? <LivePreviewRows tv /> : null}

        {!loading ? (
          <div className="px-10">
            <ContinueWatching />
          </div>
        ) : null}

        {flatRows.map((row, rowIndex) => (
          <TvRow key={row.name} title={row.name} items={row.items} first={rowIndex === 0 && !featured} />
        ))}

        {!loading ? (
          <div className="px-10 pt-2">
            <Link
              href="/films"
              data-tv-focus
              className="tv-focus inline-flex rounded-md bg-white/10 px-5 py-3 text-sm font-semibold outline-none ring-1 ring-white/10"
            >
              Voir tous les films
            </Link>
          </div>
        ) : null}

        {status ? <p className="px-10 pt-6 text-sm text-zinc-300">{status}</p> : null}
      </div>
    </main>
  );
}
