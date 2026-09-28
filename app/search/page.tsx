"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AccountGate, SiteNav } from "@/components/account";
import { IconSearch } from "@/components/icons";
import { GridSkeleton } from "@/components/loading";
import { Poster, PosterGrid } from "@/components/posters";

type PersonHit = { id: string; name: string; count: number };

export default function SearchPage() {
  return (
    <AccountGate>
      <Search />
    </AccountGate>
  );
}

function Search() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Poster[]>([]);
  const [people, setPeople] = useState<PersonHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Cherche un film, une série ou un acteur.");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setLoading(true);
    setStatus("");
    const response = await fetch(`/api/watch/search?q=${encodeURIComponent(query)}`);
    const data = (await response.json()) as {
      results?: Poster[];
      people?: PersonHit[];
      error?: string;
    };
    setLoading(false);
    if (!response.ok) {
      setItems([]);
      setPeople([]);
      setStatus(data.error || "Recherche impossible");
      return;
    }
    setItems(data.results || []);
    setPeople(data.people || []);
    setStatus(data.results?.length || data.people?.length ? "" : "Aucun résultat");
  }

  return (
    <main className="min-h-screen bg-black px-4 pb-28 pt-20 text-white sm:px-8 sm:pb-16 sm:pt-24 md:px-12">
      <SiteNav />
      <h1 className="text-3xl font-bold sm:text-4xl">Recherche</h1>
      <form onSubmit={onSubmit} className="mt-6 flex max-w-2xl gap-2 sm:mt-8 sm:gap-3">
        <div className="relative min-w-0 flex-1">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Titre ou acteur"
            className="h-12 w-full rounded-lg bg-zinc-900 pl-10 pr-4 outline-none ring-1 ring-white/10 focus:ring-white/25"
          />
        </div>
        <button
          type="submit"
          className="h-12 shrink-0 rounded-lg bg-red-600 px-4 text-sm font-semibold sm:px-5"
        >
          OK
        </button>
      </form>
      <div className="mt-8 space-y-10 sm:mt-10">
        {loading ? <GridSkeleton /> : null}

        {!loading && people.length ? (
          <section>
            <h2 className="mb-4 text-lg font-semibold sm:text-xl">Acteurs</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {people.map((person) => (
                <li key={person.id}>
                  <Link
                    href={`/people/${encodeURIComponent(person.id)}`}
                    className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-4 ring-1 ring-white/10 hover:bg-white/10"
                  >
                    <span>
                      <span className="block font-medium">{person.name}</span>
                      <span className="text-xs text-zinc-400">{person.count}+ titres</span>
                    </span>
                    <span className="text-sm text-zinc-400">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {!loading && items.length ? (
          <section>
            <h2 className="mb-4 text-lg font-semibold sm:text-xl">Titres</h2>
            <div className="rise">
              <PosterGrid items={items} />
            </div>
          </section>
        ) : null}

        {!loading && !items.length && !people.length ? (
          <p className="text-zinc-400">{status}</p>
        ) : null}
      </div>
    </main>
  );
}
