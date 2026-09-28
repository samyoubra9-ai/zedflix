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
  items?: Poster[];
  hasMore?: boolean;
  error?: string;
};

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
  const [items, setItems] = useState<Poster[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
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
    setItems([]);
    setPage(1);
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
        setItems(data.items || []);
        setHasMore(Boolean(data.hasMore));
        setStatus(data.items?.length ? "" : "Aucun titre");
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

  async function loadMore() {
    const next = page + 1;
    setLoadingMore(true);
    const response = await fetch(
      `/api/watch/genres?id=${encodeURIComponent(genreId)}&page=${next}`,
    );
    const data = (await response.json()) as GenrePayload;
    setLoadingMore(false);
    if (!response.ok) {
      setStatus(data.error || "Impossible de charger plus");
      return;
    }
    setPage(next);
    setHasMore(Boolean(data.hasMore));
    setItems((current) => {
      const seen = new Set(current.map((item) => item.id));
      return [...current, ...(data.items || []).filter((item) => !seen.has(item.id))];
    });
  }

  return (
    <main className="min-h-screen bg-black px-4 pb-28 pt-20 text-white sm:px-8 sm:pb-16 sm:pt-24 md:px-12">
      <SiteNav />
      <p className="text-sm font-semibold tracking-[0.18em] text-zinc-500">GENRE</p>
      <h1 className="mt-2 text-3xl font-bold capitalize sm:text-4xl">{name}</h1>

      {chips.length ? (
        <div className="mt-5 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
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

      <div className="mt-8">
        {loading ? <GridSkeleton /> : null}
        {!loading && items.length ? (
          <div className="rise space-y-8">
            <PosterGrid items={items} />
            {hasMore ? (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="min-h-11 rounded-lg bg-white/10 px-5 py-3 text-sm font-semibold ring-1 ring-white/10 disabled:opacity-50"
                >
                  {loadingMore ? "Chargement…" : "Voir plus"}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        {!loading && !items.length ? <p className="text-zinc-400">{status}</p> : null}
      </div>
    </main>
  );
}
