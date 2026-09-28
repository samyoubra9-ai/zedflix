"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountGate, SiteNav } from "@/components/account";
import { CastRow, MetaChips, type CastGenre, type CastPerson } from "@/components/cast";
import { IconPlay } from "@/components/icons";
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
    <main className="min-h-screen bg-black pb-24 text-white md:pb-10">
      <SiteNav />
      {loading ? <HeroSkeleton /> : null}
      {!loading && film ? (
        <>
          <section className="rise relative min-h-[70vh]">
            <img src={film.backdrop || film.poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/20" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30" />
          <div className="relative flex min-h-[58vh] max-w-2xl flex-col justify-end px-4 pb-10 pt-24 sm:min-h-[70vh] sm:px-8 sm:pb-16 sm:pt-28 md:px-12">
            <h1 className="text-3xl font-bold sm:text-4xl md:text-6xl">{film.title}</h1>
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
                className="mt-6 inline-flex min-h-12 w-fit items-center gap-2 rounded-md bg-white px-5 py-3 text-base font-semibold text-black sm:px-6 sm:text-lg"
              >
                <IconPlay className="h-4 w-4" />
                Lecture
              </Link>
            </div>
          </section>
          <section className="px-4 pb-10 sm:px-8 md:px-12">
            <CastRow cast={film.cast || []} />
          </section>
        </>
      ) : (
        !loading ? <p className="px-6 pt-28 text-zinc-400">{status}</p> : null
      )}
    </main>
  );
}
