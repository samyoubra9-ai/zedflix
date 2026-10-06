"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { AccountGate, SiteNav, currentCatalogTab, type CatalogTab } from "@/components/account";
import { useCopy, useSiteLang } from "@/components/locale";
import { IconSearch } from "@/components/icons";
import { useOpenDetail } from "@/components/detail";
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
  const router = useRouter();
  const copy = useCopy();
  const lang = useSiteLang();
  const [tab, setTab] = useState<CatalogTab>("stream");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Poster[]>([]);
  const [people, setPeople] = useState<PersonHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(copy.searchHintFilm);
  const [notice, setNotice] = useState("");
  const [canRetry, setCanRetry] = useState(false);
  const openDetail = useOpenDetail();
  const requestId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const current = currentCatalogTab();
    setTab(current);
    setStatus(
      current === "anime"
        ? copy.searchHintAnime
        : current === "live"
          ? copy.searchHintLive
          : current === "turkey"
            ? copy.searchHintTurkey
            : copy.searchHintFilm,
    );
  }, []);

  async function openItem(item: Poster) {
    if (item.id) {
      openDetail(item);
      return;
    }
    setNotice(copy.opening);
    try {
      const response = await fetch(`/api/watch/search?q=${encodeURIComponent(item.title)}&match=1`, {
        signal: AbortSignal.timeout(8000),
      });
      const data = (await response.json()) as { result?: Poster; error?: string };
      if (!response.ok || !data.result?.id) {
        setNotice(copy.notPlayable);
        return;
      }
      setNotice("");
      openDetail(data.result);
    } catch {
      setNotice(copy.notPlayable);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    const q = query.trim();
    if (tab === "live") {
      router.push(`/tv?q=${encodeURIComponent(q)}`);
      return;
    }
    const id = ++requestId.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 12000);
    setLoading(true);
    setNotice("");
    setCanRetry(false);
    try {
      const tabQuery = tab === "anime" ? "&tab=anime" : tab === "turkey" ? "&tab=turkey" : "";
      const response = await fetch(`/api/watch/search?q=${encodeURIComponent(q)}${tabQuery}`, {
        signal: controller.signal,
      });
      const data = (await response.json()) as {
        results?: Poster[];
        people?: PersonHit[];
        error?: string;
      };
      if (id !== requestId.current) return;
      if (!response.ok) {
        setCanRetry(true);
        setNotice(data.error || copy.searchFailed);
        return;
      }
      const primary = data.results || [];
      setItems(primary);
      setPeople(tab === "anime" || tab === "turkey" ? [] : data.people || []);
      setLoading(false);
      setStatus(primary.length || data.people?.length ? "" : copy.noResults);
      if (tab === "anime" || tab === "turkey" || lang === "en") return;
      try {
        const more = await fetch(`/api/watch/search?q=${encodeURIComponent(q)}&extra=1`, {
          signal: AbortSignal.timeout(8000),
        });
        const moreData = (await more.json()) as { results?: Poster[] };
        if (id !== requestId.current) return;
        const seen = new Set(primary.map((item) => item.title.toLowerCase()));
        const extra = (moreData.results || []).filter((item) => item.title && !seen.has(item.title.toLowerCase()));
        if (extra.length) {
          setItems([...primary, ...extra]);
          setStatus("");
        }
      } catch {
        /* the first results stay on screen */
      }
    } catch {
      if (id !== requestId.current) return;
      setCanRetry(true);
      setNotice(copy.searchFailed);
    } finally {
      window.clearTimeout(timer);
      if (id === requestId.current) setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black px-4 pb-28 pt-20 text-white sm:px-8 sm:pb-16 sm:pt-24 md:px-12">
      <SiteNav />
      <h1 className="text-3xl font-bold sm:text-4xl">{copy.search}</h1>
      <form id="catalog-search" onSubmit={onSubmit} className="mt-6 flex max-w-2xl gap-2 sm:mt-8 sm:gap-3">
        <div className="relative min-w-0 flex-1">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              tab === "anime"
                ? copy.searchAnime
                : tab === "live"
                  ? copy.searchLive
                  : tab === "turkey"
                    ? copy.searchTurkey
                    : copy.searchFilm
            }
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
        {loading ? (
          <div className="flex items-center gap-3 text-sm text-zinc-300">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-[#e50914]" />
            {copy.searching}
          </div>
        ) : null}

        {people.length ? (
          <section>
            <h2 className="mb-4 text-lg font-semibold sm:text-xl">{copy.actors}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {people.map((person) => (
                <li key={person.id}>
                  <Link
                    href={`/people/${encodeURIComponent(person.id)}`}
                    className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-4 ring-1 ring-white/10 hover:bg-white/10"
                  >
                    <span>
                      <span className="block font-medium">{person.name}</span>
                      <span className="text-xs text-zinc-400">{person.count}+ {copy.titles}</span>
                    </span>
                    <span className="text-sm text-zinc-400">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {items.length ? (
          <section>
            <div className="rise">
              <PosterGrid items={items} onOpen={openItem} />
            </div>
          </section>
        ) : null}

        {!loading && !items.length && !people.length ? (
          <p className="text-zinc-400">{status}</p>
        ) : null}
      </div>
      {notice ? (
        <div className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-zinc-900 px-5 py-3 text-sm text-white ring-1 ring-white/15 md:bottom-8">
          <span>{notice}</span>
          {canRetry ? (
            <button
              type="button"
              className="rounded-full bg-[#e50914] px-3 py-1 text-xs font-semibold"
              onClick={() => {
                const form = document.getElementById("catalog-search");
                if (form instanceof HTMLFormElement) form.requestSubmit();
              }}
            >
              Réessayer
            </button>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
