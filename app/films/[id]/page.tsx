"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountGate, SiteNav } from "@/components/account";
import { CastRow, MetaChips, type CastGenre, type CastPerson } from "@/components/cast";
import { HeroSkeleton } from "@/components/loading";

type Film = {
  title: string;
  overview: string;
  poster: string;
  backdrop: string;
  cast?: CastPerson[];
  genres?: CastGenre[];
  directors?: string[];
  year?: string;
  runtime?: string;
  quality?: string;
};

export default function FilmPage() {
  return (
    <AccountGate>
      <FilmDetail />
    </AccountGate>
  );
}

function FilmDetail() {
  const params = useParams<{ id: string }>();
  const [film, setFilm] = useState<Film | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let stop = false;
    fetch(`/api/watch/title?id=${encodeURIComponent(params.id)}&kind=movie`)
      .then(async (response) => {
        const data = (await response.json()) as Film & { error?: string };
        if (stop) return;
        if (!response.ok) {
          setStatus(data.error || "Film introuvable");
          setLoading(false);
          return;
        }
        setFilm(data);
        setLoading(false);
      })
      .catch(() => {
        if (!stop) {
          setStatus("Film introuvable");
          setLoading(false);
        }
      });
    return () => {
      stop = true;
    };
  }, [params.id]);

  return (
    <main className="min-h-screen bg-black text-white">
      <SiteNav />
      {loading ? <HeroSkeleton /> : null}
      {!loading && film ? (
        <>
          <section className="rise relative min-h-[70vh]">
            <img src={film.backdrop || film.poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/20" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30" />
            <div className="relative flex min-h-[70vh] max-w-2xl flex-col justify-end px-6 pb-16 pt-28 md:px-12">
              <h1 className="text-4xl font-bold md:text-6xl">{film.title}</h1>
              <MetaChips
                genres={film.genres}
                directors={film.directors}
                year={film.year}
                runtime={film.runtime}
                quality={film.quality}
              />
              {film.overview ? <p className="mt-4 text-lg text-white/90">{film.overview}</p> : null}
              <Link
                href={`/watch/${params.id}`}
                className="mt-6 inline-flex w-fit rounded bg-white px-6 py-3 text-lg font-semibold text-black"
              >
                Lecture
              </Link>
            </div>
          </section>
          <section className="px-6 pb-16 md:px-12">
            <CastRow cast={film.cast || []} />
          </section>
        </>
      ) : (
        !loading ? <p className="px-6 pt-28 text-zinc-400">{status}</p> : null
      )}
    </main>
  );
}
