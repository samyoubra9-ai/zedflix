"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountGate, SiteNav } from "@/components/account";
import { ContinueWatching } from "@/components/continue-watching";
import { useOpenDetail } from "@/components/detail";
import { IconInfo, IconPlay } from "@/components/icons";
import { HeroSkeleton } from "@/components/loading";
import { MyListButton } from "@/components/my-list-button";
import { Poster, PosterRow } from "@/components/posters";
import { useTvMode } from "@/hooks/use-tv-mode";
import { TvBrowse } from "@/components/tv/tv-browse";

type HeroCard = Poster & { overview: string; backdrop: string };
type Row = { name: string; items: HeroCard[]; seeAll?: string };
type Genre = { id: string; name: string };

export default function BrowsePage() {
  return (
    <AccountGate>
      <BrowseSwitcher />
    </AccountGate>
  );
}

function BrowseSwitcher() {
  const tv = useTvMode();
  if (tv) return <TvBrowse />;
  return <BrowseHome />;
}

function cleanHomeRows(rows: Row[]) {
  const seen = new Set<string>();
  return rows
    .filter((row) => !/aventure|horreur|comédie|comedie|thriller|science|action|drame|fantastique|crime|romance/i.test(row.name))
    .map((row) => ({
      ...row,
      items: (row.items || []).filter((item) => {
        const key = (item.title || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/\p{M}+/gu, "")
          .replace(/\s*saison\s*\d+.*/i, "")
          .replace(/[^a-z0-9]+/g, " ")
          .trim();
        if (!item.id || !item.title || item.title === "null" || !key || seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    }))
    .filter((row) => row.items.length > 0);
}

function BrowseHome() {
  const [hero, setHero] = useState<HeroCard[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [fresh, setFresh] = useState<Row[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);
  const [heroReady, setHeroReady] = useState(false);
  const [status, setStatus] = useState("");
  const openDetail = useOpenDetail();

  useEffect(() => {
    let stop = false;
    fetch("/api/watch/home?part=fresh")
      .then(async (response) => {
        const data = (await response.json()) as { rows?: Row[] };
        if (!stop && response.ok) setFresh(cleanHomeRows(data.rows || []));
      })
      .catch(() => undefined);

    fetch("/api/watch/genres")
      .then(async (response) => {
        const data = (await response.json()) as { genres?: Genre[] };
        if (!stop) setGenres(data.genres || []);
      })
      .catch(() => undefined);

    fetch("/api/watch/home?part=spotlight")
      .then(async (response) => {
        const data = (await response.json()) as { hero?: HeroCard[]; error?: string };
        if (stop) return;
        if (!response.ok) {
          setStatus(data.error || "L’accueil est indisponible");
          setHeroReady(true);
          return;
        }
        setHero((data.hero || []).filter((item) => item?.id && item.title && item.title !== "null" && item.backdrop));
        setHeroReady(true);
        const rowsResponse = await fetch("/api/watch/home?part=rows");
        const rowsData = (await rowsResponse.json()) as { rows?: Row[] };
        if (stop) return;
        if (rowsResponse.ok) setRows(cleanHomeRows(rowsData.rows || []));
      })
      .catch(() => {
        if (!stop) {
          setStatus("L’accueil est indisponible");
          setHeroReady(true);
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
      }, 280);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [hero.length]);

  function goTo(next: number) {
    if (next === index) return;
    setFade(false);
    window.setTimeout(() => {
      setIndex(next);
      setFade(true);
    }, 220);
  }

  const featured = hero[index];
  const taken = new Set(
    rows.flatMap((row) =>
      row.items.map((item) =>
        (item.title || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/\p{M}+/gu, "")
          .replace(/\s*saison\s*\d+.*/i, "")
          .replace(/[^a-z0-9]+/g, " ")
          .trim(),
      ),
    ),
  );
  const freshRows = fresh
    .map((row) => ({
      ...row,
      items: row.items.filter((item) => {
        const key = (item.title || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/\p{M}+/gu, "")
          .replace(/\s*saison\s*\d+.*/i, "")
          .replace(/[^a-z0-9]+/g, " ")
          .trim();
        return key && !taken.has(key);
      }),
    }))
    .filter((row) => row.items.length > 0);

  return (
    <main className="min-h-screen bg-black pb-24 text-white md:pb-10">
      <SiteNav />
      {!heroReady ? <HeroSkeleton /> : null}

      {heroReady && featured ? (
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
            <p className="text-[11px] font-semibold tracking-[0.2em] text-zinc-300 sm:text-sm">
              {featured.kind === "show" ? "SÉRIE" : "FILM"}
            </p>
            <h1 className="mt-2 text-3xl font-bold leading-tight sm:mt-3 sm:text-5xl md:text-6xl">
              {featured.title}
            </h1>
            {featured.overview ? (
              <p className="mt-3 line-clamp-3 text-sm text-white/85 sm:mt-4 sm:text-lg">
                {featured.overview}
              </p>
            ) : null}

            <div className="mt-5 hidden flex-wrap items-center gap-3 sm:mt-6 sm:flex">
              <button
                type="button"
                onClick={() => openDetail(featured)}
                className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-black sm:px-6 sm:py-3 sm:text-lg"
              >
                <IconPlay className="h-4 w-4 sm:h-5 sm:w-5" />
                Lecture
              </button>
              <button
                type="button"
                onClick={() => openDetail(featured)}
                className="inline-flex items-center gap-2 rounded-md bg-white/20 px-5 py-2.5 text-sm font-semibold backdrop-blur hover:bg-white/30 sm:px-6 sm:py-3 sm:text-lg"
              >
                <IconInfo className="h-4 w-4 sm:h-5 sm:w-5" />
                Plus d’infos
              </button>
              <MyListButton item={featured} size="lg" />
            </div>

            {hero.length > 1 ? (
              <div className="mt-5 flex gap-2 sm:mt-6">
                {hero.map((card, dot) => (
                  <button
                    key={`dot-${card.kind}-${card.id}`}
                    type="button"
                    aria-label={`Slide ${dot + 1}`}
                    onClick={() => goTo(dot)}
                    className={`h-1 rounded-full transition-all ${
                      dot === index ? "w-6 bg-white" : "w-3 bg-white/35 hover:bg-white/55"
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </div>

          {/* Mobile sticky CTA billboard */}
          <div className="absolute inset-x-0 bottom-0 z-20 flex gap-2 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
            <button
              type="button"
              onClick={() => openDetail(featured)}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-white text-sm font-semibold text-black"
            >
              <IconPlay className="h-4 w-4" />
              Lecture
            </button>
            <button
              type="button"
              onClick={() => openDetail(featured)}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-white/20 text-sm font-semibold backdrop-blur"
            >
              <IconInfo className="h-4 w-4" />
              Infos
            </button>
            <MyListButton item={featured} />
          </div>
        </section>
      ) : null}

      {heroReady && !featured ? <div className="h-16 sm:h-24" /> : null}

      <div className="relative z-10 space-y-8 px-4 pb-6 sm:-mt-2 sm:space-y-10 sm:px-8 md:px-12">
        {heroReady ? (
          <div className="flex flex-wrap gap-2">
            <Link href="/films" className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-black">
              Films
            </Link>
            <Link href="/series" className="rounded-md bg-white/15 px-4 py-2 text-sm font-semibold ring-1 ring-white/15">
              Séries
            </Link>
            <Link href="/search" className="rounded-md bg-white/15 px-4 py-2 text-sm font-semibold ring-1 ring-white/15">
              Recherche
            </Link>
          </div>
        ) : null}

        {heroReady ? (
          <div className="stagger-row -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            {genres.map((genre) => (
              <Link
                key={genre.id}
                href={`/genres/${encodeURIComponent(genre.id)}`}
                className="shrink-0 rounded-full bg-white/10 px-3.5 py-2 text-xs font-medium ring-1 ring-white/10 transition hover:bg-white/15 sm:text-sm"
              >
                {genre.name}
              </Link>
            ))}
          </div>
        ) : null}

        {heroReady ? <ContinueWatching /> : null}

        {rows.map((row, rowIndex) => (
          <section key={row.name} className="stagger-row" style={{ animationDelay: `${rowIndex * 70}ms` }}>
            <div className="mb-2.5 flex items-end justify-between gap-3 sm:mb-3">
              <h2 className="min-w-0 flex-1 truncate text-base font-semibold sm:text-xl">{row.name}</h2>
              {row.seeAll ? (
                <Link href={row.seeAll} className="shrink-0 text-xs font-medium text-zinc-400 hover:text-white sm:text-sm">
                  Voir tout
                </Link>
              ) : null}
            </div>
            <PosterRow items={row.items} />
          </section>
        ))}
        {freshRows.map((row) => (
          <section key={row.name}>
            <div className="mb-2.5 flex items-end justify-between gap-3 sm:mb-3">
              <h2 className="min-w-0 flex-1 truncate text-base font-semibold sm:text-xl">{row.name}</h2>
              {row.seeAll ? (
                <Link href={row.seeAll} className="shrink-0 text-xs font-medium text-zinc-400 hover:text-white sm:text-sm">
                  Voir tout
                </Link>
              ) : null}
            </div>
            <PosterRow items={row.items} />
          </section>
        ))}
        {status ? <p className="text-sm text-zinc-300">{status}</p> : null}
      </div>
    </main>
  );
}
