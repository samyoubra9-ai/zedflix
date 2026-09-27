"use client";

import { useEffect, useState } from "react";
import { AccountGate, SiteNav } from "@/components/account";
import { useOpenDetail } from "@/components/detail";
import { HeroSkeleton, RowSkeleton } from "@/components/loading";
import { Poster, PosterRow } from "@/components/posters";

type HeroCard = Poster & { overview: string; backdrop: string };
type Row = { name: string; items: HeroCard[] };

export default function BrowsePage() {
  return (
    <AccountGate>
      <BrowseHome />
    </AccountGate>
  );
}

function BrowseHome() {
  const [hero, setHero] = useState<HeroCard[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [index, setIndex] = useState(0);
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
      setIndex((current) => (current + 1) % hero.length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [hero.length]);

  const featured = hero[index];

  return (
    <main className="min-h-screen bg-black text-white">
      <SiteNav />
      {loading ? <HeroSkeleton /> : null}
      {!loading && featured ? (
        <section className="rise relative h-[78vh] min-h-[520px]">
          <img src={featured.backdrop || featured.poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20" />
          <div className="absolute bottom-24 left-6 max-w-xl md:left-12">
            <p className="text-sm font-semibold tracking-[0.2em]">{featured.kind === "show" ? "SÉRIE" : "FILM"}</p>
            <h1 className="mt-3 text-4xl font-bold md:text-6xl">{featured.title}</h1>
            {featured.overview ? <p className="mt-4 line-clamp-3 text-lg text-white/90">{featured.overview}</p> : null}
            <button
              type="button"
              onClick={() => openDetail(featured)}
              className="mt-6 rounded bg-white px-6 py-3 text-lg font-semibold text-black"
            >
              Lecture
            </button>
          </div>
          {hero.length > 1 ? (
            <div className="absolute bottom-28 right-6 flex gap-2 md:right-12">
              <button
                type="button"
                aria-label="Précédent"
                onClick={() => setIndex((current) => (current - 1 + hero.length) % hero.length)}
                className="h-11 w-11 rounded-full border border-white/40 bg-black/40 text-xl"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Suivant"
                onClick={() => setIndex((current) => (current + 1) % hero.length)}
                className="h-11 w-11 rounded-full border border-white/40 bg-black/40 text-xl"
              >
                ›
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
      {!loading && !featured ? <div className="h-24" /> : null}
      <div className="relative z-10 -mt-6 space-y-8 px-6 pb-16 md:px-12">
        {loading ? (
          <>
            <RowSkeleton />
            <RowSkeleton />
          </>
        ) : null}
        {rows.map((row) => (
          <section key={row.name}>
            <h2 className="mb-3 text-xl font-semibold">{row.name}</h2>
            <PosterRow items={row.items} />
          </section>
        ))}
        {status ? <p className="text-sm text-zinc-300">{status}</p> : null}
      </div>
    </main>
  );
}
