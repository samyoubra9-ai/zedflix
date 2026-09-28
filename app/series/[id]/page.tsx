"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountGate, SiteNav } from "@/components/account";
import { CastRow, MetaChips, type CastGenre, type CastPerson } from "@/components/cast";
import { HeroSkeleton, Spinner } from "@/components/loading";

type Season = { id: string; title: string };
type Episode = { number: number; title: string };
type Show = {
  title: string;
  overview: string;
  poster: string;
  backdrop: string;
  seasons: Season[];
  episodes: Episode[];
  cast?: CastPerson[];
  genres?: CastGenre[];
  directors?: string[];
  year?: string;
  runtime?: string;
  quality?: string;
};

export default function SeriesDetailPage() {
  return (
    <AccountGate>
      <SeriesDetail />
    </AccountGate>
  );
}

function SeriesDetail() {
  const params = useParams<{ id: string }>();
  const [show, setShow] = useState<Show | null>(null);
  const [seasonId, setSeasonId] = useState(params.id);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let stop = false;
    fetch(`/api/watch/title?id=${encodeURIComponent(params.id)}&kind=show`)
      .then(async (response) => {
        const data = (await response.json()) as Show & { error?: string };
        if (stop) return;
        if (!response.ok) {
          setStatus(data.error || "Série introuvable");
          setLoading(false);
          return;
        }
        setShow(data);
        setSeasonId(params.id);
        setEpisodes(data.episodes || []);
        setLoading(false);
      })
      .catch(() => {
        if (!stop) {
          setStatus("Série introuvable");
          setLoading(false);
        }
      });
    return () => {
      stop = true;
    };
  }, [params.id]);

  async function openSeason(id: string) {
    setSeasonId(id);
    setEpisodesLoading(true);
    const response = await fetch(`/api/watch/show?id=${encodeURIComponent(id)}`);
    const data = (await response.json()) as { episodes?: Episode[]; error?: string };
    setEpisodesLoading(false);
    if (!response.ok) {
      setStatus(data.error || "Saison introuvable");
      return;
    }
    setEpisodes(data.episodes || []);
    setStatus("");
  }

  return (
    <main className="min-h-screen bg-black pb-24 text-white md:pb-10">
      <SiteNav />
      {loading ? <HeroSkeleton /> : null}
      {!loading && show ? (
        <>
          <section className="rise relative min-h-[52vh]">
            <img src={show.backdrop || show.poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/20" />
            <div className="relative flex min-h-[48vh] max-w-2xl flex-col justify-end px-4 pb-8 pt-24 sm:min-h-[52vh] sm:px-8 sm:pb-10 sm:pt-28 md:px-12">
              <h1 className="text-3xl font-bold sm:text-4xl md:text-6xl">{show.title}</h1>
              <MetaChips
                genres={show.genres}
                directors={show.directors}
                year={show.year}
                runtime={show.runtime}
                quality={show.quality}
              />
              {show.overview ? <p className="mt-4 text-lg text-white/90">{show.overview}</p> : null}
            </div>
          </section>
          <section className="px-4 pb-10 sm:px-8 md:px-12">
            <CastRow cast={show.cast || []} />
            <div className="-mx-4 mt-10 flex gap-2 overflow-x-auto px-4 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] sm:mx-0 sm:px-0">
              {show.seasons.map((season) => (
                <button
                  key={season.id}
                  type="button"
                  onClick={() => openSeason(season.id)}
                  className={`min-h-10 shrink-0 rounded-md px-4 py-2 text-sm ${season.id === seasonId ? "bg-white text-black" : "bg-white/10"}`}
                >
                  {season.title.replace(/^.+-\s*/, "")}
                </button>
              ))}
            </div>
            {episodesLoading ? (
              <div className="mt-10 flex justify-center">
                <Spinner />
              </div>
            ) : (
              <ul className="mt-6 divide-y divide-white/10">
                {episodes.map((episode) => (
                  <li key={episode.number}>
                    <Link
                      href={`/watch/${seasonId}/${episode.number}`}
                      className="flex min-h-12 items-center justify-between gap-3 py-3.5 touch-manipulation"
                    >
                      <span className="min-w-0 truncate text-sm sm:text-base">
                        {episode.number}. {episode.title}
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-zinc-300">Lecture</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {status ? <p className="mt-4 text-sm text-zinc-400">{status}</p> : null}
          </section>
        </>
      ) : (
        !loading ? <p className="px-6 pt-28 text-zinc-400">{status}</p> : null
      )}
    </main>
  );
}
