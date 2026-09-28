"use client";

import Link from "next/link";

export type CastPerson = { id: string; name: string; image: string };
export type CastGenre = { id: string; name: string };

export function CastRow({ cast }: { cast: CastPerson[] }) {
  if (!cast.length) return null;
  return (
    <section className="mt-8">
      <h3 className="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">Distribution</h3>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] sm:mx-0 sm:gap-4 sm:px-0">
        {cast.map((person) => (
          <Link
            key={person.id}
            href={`/people/${encodeURIComponent(person.id)}`}
            className="w-[4.75rem] shrink-0 touch-manipulation text-center sm:w-24"
          >
            <span className="mx-auto block aspect-[2/3] w-full overflow-hidden rounded-md bg-zinc-900 ring-1 ring-white/5">
              {person.image ? (
                <img src={person.image} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <span className="flex h-full items-center justify-center text-xl text-zinc-500 sm:text-2xl">
                  {(person.name[0] || "?").toUpperCase()}
                </span>
              )}
            </span>
            <span className="mt-1.5 block line-clamp-2 text-[11px] leading-tight text-zinc-300 sm:mt-2 sm:text-xs">
              {person.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function MetaChips({
  genres,
  directors,
  year,
  runtime,
  quality,
}: {
  genres?: CastGenre[];
  directors?: string[];
  year?: string;
  runtime?: string;
  quality?: string;
}) {
  const chips = [
    ...(quality ? [quality] : []),
    ...(year ? [year] : []),
    ...(runtime ? [runtime] : []),
    ...(directors || []).map((name) => `Réal. ${name}`),
  ];
  if (!chips.length && !(genres && genres.length)) return null;
  return (
    <div className="mt-4 space-y-3">
      {chips.length ? (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span key={chip} className="rounded bg-white/10 px-2.5 py-1 text-xs text-zinc-200">
              {chip}
            </span>
          ))}
        </div>
      ) : null}
      {genres?.length ? (
        <div className="flex flex-wrap gap-2">
          {genres.map((genre) => (
            <Link
              key={genre.id}
              href={`/genres/${encodeURIComponent(genre.id)}`}
              className="rounded-full border border-white/15 px-3 py-1 text-xs text-zinc-300 transition hover:border-white/40 hover:bg-white/5 hover:text-white"
            >
              {genre.name}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
