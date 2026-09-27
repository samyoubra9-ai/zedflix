"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AccountGate, SiteNav } from "@/components/account";
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
    setStatus(
      data.results?.length || data.people?.length ? "" : "Aucun résultat",
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 pb-16 pt-24 text-white md:px-12">
      <SiteNav />
      <h1 className="text-4xl font-bold">Recherche</h1>
      <form onSubmit={onSubmit} className="mt-8 flex max-w-2xl gap-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Titre ou acteur"
          className="h-12 flex-1 rounded bg-zinc-800 px-4 outline-none"
        />
        <button type="submit" className="h-12 rounded bg-red-600 px-5 font-semibold">
          Chercher
        </button>
      </form>
      <div className="mt-10 space-y-10">
        {loading ? <GridSkeleton /> : null}

        {!loading && people.length ? (
          <section>
            <h2 className="mb-4 text-xl font-semibold">Acteurs</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {people.map((person) => (
                <li key={person.id}>
                  <Link
                    href={`/people/${encodeURIComponent(person.id)}`}
                    className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-4 ring-1 ring-white/10 hover:bg-white/10"
                  >
                    <span>
                      <span className="block font-medium">{person.name}</span>
                      <span className="text-xs text-zinc-400">
                        {person.count}+ titres
                      </span>
                    </span>
                    <span className="text-sm text-zinc-400">Voir →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {!loading && items.length ? (
          <section>
            <h2 className="mb-4 text-xl font-semibold">Titres</h2>
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
