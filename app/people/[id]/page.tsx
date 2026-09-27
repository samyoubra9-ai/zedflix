"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountGate, SiteNav } from "@/components/account";
import { GridSkeleton } from "@/components/loading";
import { Poster, PosterGrid } from "@/components/posters";

export default function PeoplePage() {
  return (
    <AccountGate>
      <PeopleFilmography />
    </AccountGate>
  );
}

function PeopleFilmography() {
  const params = useParams<{ id: string }>();
  const actorId = decodeURIComponent(params.id || "");
  const [name, setName] = useState(actorId.replace(/\+/g, " "));
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
    fetch(`/api/watch/people?id=${encodeURIComponent(actorId)}&page=1`)
      .then(async (response) => {
        const data = (await response.json()) as {
          name?: string;
          items?: Poster[];
          hasMore?: boolean;
          error?: string;
        };
        if (stop) return;
        if (!response.ok) {
          setStatus(data.error || "Acteur introuvable");
          setLoading(false);
          return;
        }
        setName(data.name || actorId.replace(/\+/g, " "));
        setItems(data.items || []);
        setHasMore(Boolean(data.hasMore));
        setStatus(data.items?.length ? "" : "Aucun titre trouvé pour cet acteur");
        setLoading(false);
      })
      .catch(() => {
        if (!stop) {
          setStatus("Acteur introuvable");
          setLoading(false);
        }
      });
    return () => {
      stop = true;
    };
  }, [actorId]);

  async function loadMore() {
    const next = page + 1;
    setLoadingMore(true);
    const response = await fetch(
      `/api/watch/people?id=${encodeURIComponent(actorId)}&page=${next}`,
    );
    const data = (await response.json()) as { items?: Poster[]; hasMore?: boolean; error?: string };
    setLoadingMore(false);
    if (!response.ok) {
      setStatus(data.error || "Impossible de charger plus");
      return;
    }
    setPage(next);
    setHasMore(Boolean(data.hasMore));
    setItems((current) => {
      const seen = new Set(current.map((item) => `${item.kind}:${item.id}`));
      const extra = (data.items || []).filter((item) => !seen.has(`${item.kind}:${item.id}`));
      return [...current, ...extra];
    });
  }

  return (
    <main className="min-h-screen bg-black px-6 pb-16 pt-24 text-white md:px-12">
      <SiteNav />
      <p className="text-sm font-semibold tracking-[0.18em] text-zinc-400">ACTEUR</p>
      <h1 className="mt-2 text-4xl font-bold">{name}</h1>
      <p className="mt-2 text-sm text-zinc-400">Filmographie</p>
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
