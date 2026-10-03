"use client";

import Link from "next/link";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { CastRow, MetaChips, type CastGenre, type CastPerson } from "./cast";
import { IconPlay } from "./icons";
import { LikeButton, MyListButton } from "./my-list-button";
import { useCopy } from "./locale";
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
  const copy = useCopy();
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
          setStatus(data.error || copy.sheetUnavailable);
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
          setStatus(copy.sheetUnavailable);
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
      setStatus(data.error || copy.seasonUnavailable);
      return;
    }
    setEpisodes(data.episodes || []);
  }

  const title = detail?.title || item.title;
  const backdrop = detail?.backdrop || detail?.poster || item.poster;
  const poster = detail?.poster || item.poster;
  const first = episodes[0];
  const playHref =
    item.kind === "show" && first ? `/watch/${seasonId}/${first.number}` : `/watch/${item.id}`;
  const listItem: Poster = {
    id: item.id,
    title,
    poster,
    kind: item.kind,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/80 sm:items-start sm:px-6 sm:py-8"
      onClick={onClose}
    >
      <article
        className="modal-in relative max-h-[94dvh] w-full max-w-5xl overflow-y-auto rounded-t-2xl bg-zinc-950 shadow-2xl sm:max-h-[90vh] sm:rounded-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-20 flex justify-center pt-2 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-white/25" />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.close}
          className="absolute right-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900/90 text-lg sm:right-5 sm:top-5"
        >
          ×
        </button>

        <div className="relative min-h-[42vh] sm:min-h-[48vh] md:min-h-[56vh]">
          <img src={backdrop} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/55 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-black/20" />
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 sm:px-8 sm:pb-8">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-white/75 sm:text-xs">
              {item.kind === "show" ? copy.show : copy.movie}
            </p>
            <h2 className="mt-1 max-w-3xl text-3xl font-bold sm:text-4xl md:text-5xl">{title}</h2>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {item.kind === "movie" || first ? (
                <Link
                  href={playHref}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-black sm:min-h-12 sm:px-6 sm:text-base"
                >
                  <IconPlay className="h-4 w-4" />
                  {copy.play}
                </Link>
              ) : (
                <span className="inline-flex min-h-11 items-center gap-3 rounded-md bg-white/10 px-5 py-2.5 text-sm">
                  {loading ? <Spinner className="h-5 w-5" /> : copy.playUnavailable}
                </span>
              )}
              <MyListButton item={listItem} />
              <LikeButton item={listItem} />
            </div>
          </div>
        </div>

        <div className="px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-8 sm:pb-10">
          <MetaChips
            genres={detail?.genres}
            directors={detail?.directors}
            year={detail?.year}
            runtime={detail?.runtime}
            quality={detail?.quality}
          />
          {detail?.overview ? (
            <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-zinc-200 sm:text-base">
              {detail.overview}
            </p>
          ) : null}
          {loading && !detail?.overview ? <div className="mt-5 h-16 w-full max-w-xl rounded skeleton" /> : null}
          {status ? <p className="mt-4 text-sm text-zinc-400">{status}</p> : null}

          <CastRow cast={detail?.cast || []} />

          {item.kind === "show" && detail ? (
            <div className="mt-8">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold">{copy.episodes}</h3>
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 [scrollbar-width:none]">
                  {detail.seasons.map((season) => (
                    <button
                      key={season.id}
                      type="button"
                      onClick={() => openSeason(season.id)}
                      className={`min-h-9 shrink-0 rounded-md px-3 py-1.5 text-sm ${
                        season.id === seasonId ? "bg-white text-black" : "bg-white/10"
                      }`}
                    >
                      {season.title.replace(/^.+-\s*/, "")}
                    </button>
                  ))}
                </div>
              </div>

              {episodesLoading ? (
                <div className="mt-8 flex justify-center">
                  <Spinner />
                </div>
              ) : (
                <ul className="mt-5 space-y-3">
                  {episodes.map((episode) => (
                    <li key={episode.number}>
                      <Link
                        href={`/watch/${seasonId}/${episode.number}`}
                        className="flex gap-3 rounded-xl bg-white/[0.04] p-2.5 ring-1 ring-white/10 transition hover:bg-white/[0.07] sm:gap-4 sm:p-3"
                      >
                        <span className="relative h-20 w-[8.5rem] shrink-0 overflow-hidden rounded-md bg-zinc-900 sm:h-24 sm:w-40">
                          <img
                            src={backdrop || poster}
                            alt=""
                            className="h-full w-full object-cover opacity-80"
                          />
                          <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-black">
                              <IconPlay className="h-3.5 w-3.5" />
                            </span>
                          </span>
                          <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold">
                            {episode.number}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1 py-0.5">
                          <span className="block truncate font-medium">
                            {episode.number}. {episode.title}
                          </span>
                          <span className="mt-1 line-clamp-2 text-xs text-zinc-400 sm:text-sm">
                            {detail.overview || "Appuie pour regarder cet épisode."}
                          </span>
                        </span>
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
