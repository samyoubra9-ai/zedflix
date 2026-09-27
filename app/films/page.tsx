"use client";

import { useEffect, useState } from "react";
import { AccountGate, SiteNav } from "@/components/account";
import { GridSkeleton } from "@/components/loading";
import { Poster, PosterGrid } from "@/components/posters";

export default function FilmsPage() {
  return (
    <AccountGate>
      <Catalog kind="movie" title="Films" />
    </AccountGate>
  );
}

export function Catalog({ kind, title }: { kind: "movie" | "show"; title: string }) {
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
    <main className="min-h-screen bg-black px-6 pb-16 pt-24 text-white md:px-12">
      <SiteNav />
      <h1 className="text-4xl font-bold">{title}</h1>
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
                  className="rounded bg-white/10 px-5 py-3 text-sm font-semibold disabled:opacity-50"
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
