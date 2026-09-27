"use client";

import Link from "next/link";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { CastRow, MetaChips, type CastGenre, type CastPerson } from "./cast";
import { Spinner } from "./loading";
import type { Poster } from "./posters";

const OpenDetail = createContext<(item: Poster) => void>(() => {});

export function useOpenDetail() {
  return useContext(OpenDetail);
}

export function DetailRoot({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<Poster | null>(null);
  return (
    <OpenDetail.Provider value={setItem}>
      {children}
      {item ? <DetailModal item={item} onClose={() => setItem(null)} /> : null}
    </OpenDetail.Provider>
  );
}

type Season = { id: string; title: string };
type Episode = { number: number; title: string };
type Detail = {
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

function DetailModal({ item, onClose }: { item: Poster; onClose: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [seasonId, setSeasonId] = useState(item.id);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    let stop = false;
    setLoading(true);
    fetch(`/api/watch/title?id=${encodeURIComponent(item.id)}&kind=${item.kind}`)
      .then(async (response) => {
        const data = (await response.json()) as Detail & { error?: string };
        if (stop) return;
        if (!response.ok) {
          setStatus(data.error || "Fiche indisponible");
          setLoading(false);
          return;
        }
        setDetail(data);
        setSeasonId(item.id);
        setEpisodes(data.episodes || []);
        setLoading(false);
      })
      .catch(() => {
        if (!stop) {
          setStatus("Fiche indisponible");
          setLoading(false);
        }
      });
    return () => {
      stop = true;
    };
  }, [item.id, item.kind]);

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
  }

  const title = detail?.title || item.title;
  const backdrop = detail?.backdrop || detail?.poster || item.poster;
  const first = episodes[0];
  const playHref =
    item.kind === "show" && first ? `/watch/${seasonId}/${first.number}` : `/watch/${item.id}`;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 px-4 py-10" onClick={onClose}>
      <article
        className="modal-in relative w-full max-w-4xl overflow-hidden rounded-lg bg-zinc-950 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-lg"
        >
          ×
        </button>
        <div className="relative h-72 sm:h-96">
          <img src={backdrop} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
          <div className="absolute bottom-6 left-6 right-16">
            <p className="text-xs font-semibold tracking-[0.18em] text-white/80">
              {item.kind === "show" ? "SÉRIE" : "FILM"}
            </p>
            <h2 className="mt-2 text-3xl font-bold sm:text-5xl">{title}</h2>
          </div>
        </div>
        <div className="px-6 pb-8">
          {item.kind === "movie" || first ? (
            <Link href={playHref} className="inline-flex rounded bg-white px-6 py-3 text-lg font-semibold text-black">
              Lecture
            </Link>
          ) : (
            <span className="inline-flex items-center gap-3 rounded bg-white/10 px-6 py-3 text-sm">
              {loading ? <Spinner className="h-5 w-5" /> : "Lecture indisponible"}
            </span>
          )}
          <MetaChips
            genres={detail?.genres}
            directors={detail?.directors}
            year={detail?.year}
            runtime={detail?.runtime}
            quality={detail?.quality}
          />
          {detail?.overview ? <p className="mt-5 max-w-3xl text-base leading-relaxed text-zinc-200">{detail.overview}</p> : null}
          {loading && !detail?.overview ? <div className="mt-5 h-16 w-full max-w-xl rounded skeleton" /> : null}
          {status ? <p className="mt-4 text-sm text-zinc-400">{status}</p> : null}

          <CastRow cast={detail?.cast || []} />

          {item.kind === "show" && detail ? (
            <div className="mt-8">
              <div className="flex gap-2 overflow-x-auto">
                {detail.seasons.map((season) => (
                  <button
                    key={season.id}
                    type="button"
                    onClick={() => openSeason(season.id)}
                    className={`shrink-0 rounded px-4 py-2 text-sm ${season.id === seasonId ? "bg-white text-black" : "bg-white/10"}`}
                  >
                    {season.title.replace(/^.+-\s*/, "")}
                  </button>
                ))}
              </div>
              {episodesLoading ? (
                <div className="mt-8 flex justify-center">
                  <Spinner />
                </div>
              ) : (
                <ul className="mt-4 max-h-72 divide-y divide-white/10 overflow-y-auto">
                  {episodes.map((episode) => (
                    <li key={episode.number}>
                      <Link
                        href={`/watch/${seasonId}/${episode.number}`}
                        className="flex items-center justify-between py-3"
                      >
                        <span>
                          {episode.number}. {episode.title}
                        </span>
                        <span className="text-sm text-white/70">Lecture</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </article>
    </div>
  );
}
