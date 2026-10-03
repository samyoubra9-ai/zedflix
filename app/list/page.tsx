"use client";

import { useEffect, useState } from "react";
import { AccountGate, SiteNav } from "@/components/account";
import { useCopy } from "@/components/locale";
import { Poster, PosterGrid } from "@/components/posters";
import { listMyList } from "@/lib/my-list";

export default function MyListPage() {
  return (
    <AccountGate>
      <MyList />
    </AccountGate>
  );
}

function MyList() {
  const copy = useCopy();
  const [items, setItems] = useState<Poster[]>([]);

  useEffect(() => {
    function sync() {
      setItems(listMyList());
    }
    sync();
    window.addEventListener("minuit-list", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("minuit-list", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  return (
    <main className="min-h-screen bg-black px-4 pb-28 pt-20 text-white sm:px-8 sm:pb-16 sm:pt-24 md:px-12">
      <SiteNav />
      <h1 className="text-3xl font-bold sm:text-4xl">{copy.list}</h1>
      <p className="mt-2 text-sm text-zinc-400">
        {items.length ? `${items.length} titre${items.length > 1 ? "s" : ""}` : "Ajoute des titres avec le bouton +"}
      </p>
      <div className="mt-8">
        {items.length ? (
          <div className="rise">
            <PosterGrid items={items} />
          </div>
        ) : (
          <p className="rounded-xl bg-white/5 px-4 py-8 text-center text-zinc-400 ring-1 ring-white/10">
            Ta liste est vide pour l’instant.
          </p>
        )}
      </div>
    </main>
  );
}
