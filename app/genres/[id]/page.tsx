"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountGate, SiteNav } from "@/components/account";
import { GridSkeleton } from "@/components/loading";
import { Poster, PosterGrid } from "@/components/posters";

type GenrePayload = {
  id?: string;
  name?: string;
  movies?: Poster[];
  shows?: Poster[];
  movieHasMore?: boolean;
  showHasMore?: boolean;
  error?: string;
};

type Side = "all" | "movie" | "show";

export default function GenrePage() {
  return (
    <AccountGate>
      <GenreCatalog />
    </AccountGate>
  );
}

function GenreCatalog() {
  const params = useParams<{ id: string }>();
  const genreId = decodeURIComponent(params.id || "");
  const [name, setName] = useState(genreId);
  const [movies, setMovies] = useState<Poster[]>([]);
  const [shows, setShows] = useState<Poster[]>([]);
  const [moviePage, setMoviePage] = useState(1);
  const [showPage, setShowPage] = useState(1);
  const [movieHasMore, setMovieHasMore] = useState(false);
  const [showHasMore, setShowHasMore] = useState(false);
  const [side, setSide] = useState<Side>("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState<"movie" | "show" | "">("");
  const [status, setStatus] = useState("");
  const [chips, setChips] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/watch/genres")
      .then((response) => response.json())
      .then((data: { genres?: { id: string; name: string }[] }) => setChips(data.genres || []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let stop = false;
    setLoading(true);
    setMovies([]);
    setShows([]);
    setMoviePage(1);
    setShowPage(1);
    setSide("all");
    fetch(`/api/watch/genres?id=${encodeURIComponent(genreId)}&page=1`)
      .then(async (response) => {
        const data = (await response.json()) as GenrePayload;
        if (stop) return;
        if (!response.ok) {
          setStatus(data.error || "Genre indisponible");
          setLoading(false);
          return;
        }
        setName(data.name || genreId);
        setMovies(data.movies || []);
        setShows(data.shows || []);
        setMovieHasMore(Boolean(data.movieHasMore));
        setShowHasMore(Boolean(data.showHasMore));
        setStatus(data.movies?.length || data.shows?.length ? "" : "Aucun titre");
        setLoading(false);
      })
      .catch(() => {
        if (!stop) {
          setStatus("Genre indisponible");
          setLoading(false);
        }
      });
    return () => {
      stop = true;
    };
  }, [genreId]);

  async function loadMore(kind: "movie" | "show") {
    const next = (kind === "movie" ? moviePage : showPage) + 1;
    setLoadingMore(kind);
    const response = await fetch(
      `/api/watch/genres?id=${encodeURIComponent(genreId)}&page=${next}&kind=${kind}`,
    );
    const data = (await response.json()) as GenrePayload;
    setLoadingMore("");
    if (!response.ok) {
      setStatus(data.error || "Impossible de charger plus");
      return;
    }
    if (kind === "movie") {
      setMoviePage(next);
      setMovieHasMore(Boolean(data.movieHasMore));
      setMovies((current) => merge(current, data.movies || []));
    } else {
      setShowPage(next);
      setShowHasMore(Boolean(data.showHasMore));
      setShows((current) => merge(current, data.shows || []));
    }
  }

  const showFilms = side !== "show";
  const showSeries = side !== "movie";

  return (
    <main className="min-h-screen bg-black px-4 pb-28 pt-20 text-white sm:px-8 sm:pb-16 sm:pt-24 md:px-12">
      <SiteNav />
      <Link href="/browse" className="text-sm font-medium text-zinc-400 hover:text-white">
        Films & Séries
      </Link>
      <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{name}</h1>

      <div className="mt-5 flex gap-2">
        {(
          [
            ["all", "Tout"],
            ["movie", "Films"],
            ["show", "Séries"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSide(id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              side === id ? "bg-white text-black" : "bg-white/10 text-white ring-1 ring-white/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {chips.length ? (
        <div className="mt-4 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {chips.map((genre) => (
            <Link
              key={genre.id}
              href={`/genres/${encodeURIComponent(genre.id)}`}
              className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-medium ring-1 transition sm:text-sm ${
                genre.id === genreId
                  ? "bg-white text-black ring-white"
                  : "bg-white/10 text-white ring-white/10 hover:bg-white/15"
              }`}
            >
              {genre.name}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mt-8 space-y-10">
        {loading ? <GridSkeleton /> : null}
        {!loading && showFilms ? (
          <section>
            <h2 className="mb-4 text-xl font-semibold">Films {name.toLowerCase()}</h2>
            {movies.length ? <PosterGrid items={movies} /> : <p className="text-zinc-400">Aucun film</p>}
            {movieHasMore ? (
              <div className="mt-6 flex justify-center">
                <MoreButton busy={loadingMore === "movie"} onClick={() => loadMore("movie")} />
              </div>
            ) : null}
          </section>
        ) : null}
        {!loading && showSeries ? (
          <section>
            <h2 className="mb-4 text-xl font-semibold">Séries {name.toLowerCase()}</h2>
            {shows.length ? <PosterGrid items={shows} /> : <p className="text-zinc-400">Aucune série</p>}
            {showHasMore ? (
              <div className="mt-6 flex justify-center">
                <MoreButton busy={loadingMore === "show"} onClick={() => loadMore("show")} />
              </div>
            ) : null}
          </section>
        ) : null}
        {!loading && !movies.length && !shows.length ? <p className="text-zinc-400">{status}</p> : null}
      </div>
    </main>
  );
}

function merge(current: Poster[], incoming: Poster[]) {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => item.id && !seen.has(item.id))];
}

function MoreButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="min-h-11 rounded-lg bg-white/10 px-5 py-3 text-sm font-semibold ring-1 ring-white/10 disabled:opacity-50"
    >
      {busy ? "Chargement…" : "Voir plus"}
    </button>
  );
}
