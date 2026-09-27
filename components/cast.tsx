"use client";

import Link from "next/link";

export type CastPerson = { id: string; name: string; image: string };
export type CastGenre = { id: string; name: string };

export function CastRow({ cast }: { cast: CastPerson[] }) {
  if (!cast.length) return null;
  return (
    <section className="mt-8">
      <h3 className="mb-4 text-lg font-semibold">Distribution</h3>
      <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none]">
        {cast.map((person) => (
          <Link
            key={person.id}
            href={`/people/${encodeURIComponent(person.id)}`}
            className="w-24 shrink-0 text-center"
          >
            <span className="mx-auto block aspect-[2/3] w-full overflow-hidden rounded-md bg-zinc-900">
              {person.image ? (
                <img src={person.image} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center text-2xl text-zinc-500">
                  {(person.name[0] || "?").toUpperCase()}
                </span>
              )}
            </span>
            <span className="mt-2 block line-clamp-2 text-xs text-zinc-300">{person.name}</span>
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
            <span key={genre.id} className="rounded-full border border-white/15 px-3 py-1 text-xs text-zinc-300">
              {genre.name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
