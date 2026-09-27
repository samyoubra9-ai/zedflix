import Link from "next/link";
import type { MediaItem } from "@/lib/tmdb";
import { mediaHref, watchHref } from "@/lib/tmdb";

export function Hero({ featured }: { featured: MediaItem | null }) {
  if (!featured?.backdrop) {
    return (
      <section className="relative flex min-h-[72vh] items-end bg-[#050505] px-4 pb-24 pt-32 sm:px-8 lg:px-12">
        <div className="animate-fade-up max-w-xl">
          <p className="text-sm font-semibold tracking-[0.22em] text-[#e50914]">
            MINUIT
          </p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight text-white md:text-7xl">
            Films & séries
          </h1>
          <p className="mt-5 text-lg text-zinc-400">
            Configure ta clé TMDB pour afficher le catalogue.
          </p>
        </div>
      </section>
    );
  }

  const kind = featured.mediaType === "tv" ? "Série" : "Film";

  return (
    <section className="relative isolate min-h-[86vh] overflow-hidden bg-black">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${featured.backdrop})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/25" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/25 to-black/70" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#050505] to-transparent" />

      <div className="relative z-10 mx-auto flex min-h-[86vh] w-full max-w-[1600px] items-end px-4 pb-16 pt-28 sm:px-8 sm:pb-20 lg:px-12">
        <div className="animate-fade-up max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.24em] text-[#e50914]">
            À LA UNE
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-6xl md:text-7xl">
            {featured.title}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-300">
            <span className="rounded bg-white/10 px-2 py-0.5 text-xs font-medium">
              {kind}
            </span>
            {featured.year ? <span>{featured.year}</span> : null}
            {featured.rating > 0 ? (
              <span className="text-emerald-400">{featured.rating.toFixed(1)}</span>
            ) : null}
          </div>
          {featured.overview ? (
            <p className="animate-fade-up-delay mt-5 max-w-xl text-sm leading-relaxed text-zinc-300 sm:text-base line-clamp-3">
              {featured.overview}
            </p>
          ) : null}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={watchHref(featured)}
              className="inline-flex items-center gap-2 rounded-md bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7L8 5z" />
              </svg>
              Lecture
            </Link>
            <Link
              href={mediaHref(featured)}
              className="inline-flex items-center gap-2 rounded-md bg-white/15 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/25"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4" />
                <circle cx="12" cy="16" r="0.8" fill="currentColor" />
              </svg>
              Plus d&apos;infos
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
