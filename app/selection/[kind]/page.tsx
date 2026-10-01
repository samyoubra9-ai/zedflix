"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountGate, SiteNav } from "@/components/account";
import { GridSkeleton } from "@/components/loading";
import { Poster, PosterGrid } from "@/components/posters";

type Row = { name: string; items: Poster[]; seeAll?: string };

const PAGES: Record<string, { title: string; match: RegExp }> = {
  series: { title: "Séries incontournables", match: /série/i },
  films: { title: "Films incontournables", match: /film/i },
};

export default function SelectionPage() {
  return (
    <AccountGate>
      <SelectionCatalog />
    </AccountGate>
  );
}

function SelectionCatalog() {
  const params = useParams<{ kind: string }>();
  const kind = params.kind === "films" ? "films" : "series";
  const page = PAGES[kind];
  const [items, setItems] = useState<Poster[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let stop = false;
    setLoading(true);
    fetch("/api/watch/home?part=rows")
      .then(async (response) => {
        const data = (await response.json()) as { rows?: Row[]; error?: string };
        if (stop) return;
        if (!response.ok) {
          setStatus(data.error || "Liste indisponible");
          setLoading(false);
          return;
        }
        const row = (data.rows || []).find((item) => page.match.test(item.name));
        setItems(row?.items || []);
        setStatus(row?.items.length ? "" : "Aucun titre");
        setLoading(false);
      })
      .catch(() => {
        if (!stop) {
          setStatus("Liste indisponible");
          setLoading(false);
        }
      });
    return () => {
      stop = true;
    };
  }, [kind, page.match]);

  return (
    <main className="min-h-screen bg-black px-4 pb-28 pt-20 text-white sm:px-8 sm:pb-16 sm:pt-24 md:px-12">
      <SiteNav />
      <Link href="/browse" className="text-sm font-medium text-zinc-400 hover:text-white">
        Films & Séries
      </Link>
      <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{page.title}</h1>
      <div className="mt-6 sm:mt-8">
        {loading ? <GridSkeleton /> : null}
        {!loading && items.length ? <PosterGrid items={items} /> : null}
        {!loading && !items.length ? <p className="text-zinc-400">{status}</p> : null}
      </div>
    </main>
  );
}
