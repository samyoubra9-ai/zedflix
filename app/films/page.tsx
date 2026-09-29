"use client";

import { useEffect, useState } from "react";
import { AccountGate, SiteNav } from "@/components/account";
import { GridSkeleton } from "@/components/loading";
import { Poster, PosterGrid } from "@/components/posters";
import { useTvMode } from "@/hooks/use-tv-mode";

export default function FilmsPage() {
  return (
    <AccountGate>
      <Catalog kind="movie" title="Films" />
    </AccountGate>
  );
}

export function Catalog({ kind, title }: { kind: "movie" | "show"; title: string }) {
  const tv = useTvMode();
  const [items, setItems] = useState<Poster[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let stop = false;
    setLoading(true);
    setItems([]);
    setPage(1);
    fetch(`/api/watch/list?kind=${kind}&page=1`)
      .then(async (response) => {
        const data = (await response.json()) as {
          items?: Poster[];
          hasMore?: boolean;
          error?: string;
        };
        if (stop) return;
        if (!response.ok) {
          setStatus(data.error || "Catalogue indisponible");
          setLoading(false);
          return;
        }
        setItems(data.items || []);
        setHasMore(Boolean(data.hasMore));
        setStatus(data.items?.length ? "" : "Aucun titre");
        setLoading(false);
      })
      .catch(() => {
        if (!stop) {
          setStatus("Catalogue indisponible");
          setLoading(false);
        }
      });
    return () => {
      stop = true;
    };
  }, [kind]);

  async function loadMore() {
    const next = page + 1;
    setLoadingMore(true);
    const response = await fetch(`/api/watch/list?kind=${kind}&page=${next}`);
    const data = (await response.json()) as { items?: Poster[]; hasMore?: boolean; error?: string };
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
    <main
      data-tv-zone="content"
      className={`min-h-screen bg-black text-white ${
        tv ? "px-10 pb-16 pt-10" : "px-4 pb-28 pt-20 sm:px-8 sm:pb-16 sm:pt-24 md:px-12"
      }`}
    >
      {tv ? null : <SiteNav />}
      <h1 className={`font-bold ${tv ? "text-4xl" : "text-3xl sm:text-4xl"}`}>{title}</h1>
      <div className={tv ? "mt-8" : "mt-6 sm:mt-8"}>
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
                  data-tv-focus
                  className={`tv-focus min-h-11 rounded-lg bg-white/10 px-5 py-3 text-sm font-semibold outline-none ring-1 ring-white/10 disabled:opacity-50 ${
                    tv ? "px-8 py-4 text-base" : ""
                  }`}
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
