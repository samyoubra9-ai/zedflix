const POINTS = [
  {
    title: "Sur le téléphone",
    text: "Minuit s’installe avec un seul fichier, puis s’ouvre comme une application.",
  },
  {
    title: "Ton compte",
    text: "L’accès est personnel. Il a une date, et il se ferme quand elle est passée.",
  },
  {
    title: "Un seul appareil",
    text: "Le compte reste lié à ton téléphone. Un autre appareil demande d’être délié.",
  },
];

const STEPS = [
  "Télécharge le fichier.",
  "Ouvre-le depuis les notifications ou les téléchargements.",
  "Autorise l’installation de l’application.",
  "Connecte-toi avec le compte qui t’a été donné.",
];

type Poster = { src: string; title: string };

async function loadPosters(): Promise<Poster[]> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return [];
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/trending/all/week?api_key=${key}&language=fr-FR`,
      { next: { revalidate: 60 * 60 * 12 } },
    );
    if (!response.ok) return [];
    const data = (await response.json()) as {
      results?: { poster_path?: string | null; title?: string; name?: string }[];
    };
    return (data.results || [])
      .filter((item) => item.poster_path)
      .slice(0, 24)
      .map((item) => ({
        src: `https://image.tmdb.org/t/p/w342${item.poster_path}`,
        title: item.title || item.name || "Affiche",
      }));
  } catch {
    return [];
  }
}

export default async function Home() {
  const posters = await loadPosters();
  const wall = posters.slice(0, 16);
  const row = posters.slice(0, 12);

  return (
    <div className="min-h-full bg-[#070707] text-white">
      <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center px-6 py-6">
        <img src="/mark.png" alt="" className="h-10 w-10 rounded-xl" />
        <span className="ml-3 text-sm font-semibold tracking-[0.22em]">MINUIT</span>
      </header>

      <main>
        <section className="relative isolate -mt-20 min-h-[38rem] overflow-hidden">
          {wall.length > 0 ? (
            <div className="pointer-events-none absolute inset-0 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              {wall.map((poster) => (
                <img
                  key={poster.src}
                  src={poster.src}
                  alt=""
                  className="aspect-[2/3] w-full object-cover"
                />
              ))}
            </div>
          ) : null}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#070707] via-[#070707]/88 to-[#070707]/20" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070707] via-[#070707]/35 to-[#070707]/75" />

          <div className="relative z-10 mx-auto flex min-h-[38rem] w-full max-w-6xl items-end px-6 pb-16 pt-32">
            <div>
              <p className="text-sm font-semibold tracking-[0.2em] text-red-600">APPLICATION ANDROID</p>
              <h1 className="mt-4 text-5xl font-semibold tracking-tight md:text-7xl">Minuit</h1>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-zinc-300">
                Films et séries sur ton téléphone. Un compte, une installation, puis l’écran d’accueil.
              </p>
              <a
                href="/minuit.apk"
                className="mt-8 inline-flex rounded-lg bg-red-600 px-6 py-4 text-lg font-medium text-white"
              >
                Télécharger pour Android
              </a>
              <p className="mt-4 max-w-md text-sm text-zinc-400">
                Le fichier s’appelle minuit.apk. Après le téléchargement, autorise l’installation.
              </p>
            </div>
          </div>
        </section>

        {row.length > 0 ? (
          <section className="border-t border-white/10">
            <div className="mx-auto w-full max-w-6xl px-6 py-10">
              <h2 className="text-lg font-medium">À l’affiche</h2>
              <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                {row.map((poster) => (
                  <img
                    key={`row-${poster.src}`}
                    src={poster.src}
                    alt={poster.title}
                    className="h-56 w-auto shrink-0 rounded-md object-cover"
                  />
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="border-t border-white/10">
          <div className="mx-auto grid w-full max-w-6xl gap-4 px-6 py-14 md:grid-cols-3">
            {POINTS.map((point) => (
              <article key={point.title} className="rounded-2xl border border-white/10 bg-zinc-950 p-5">
                <h2 className="text-lg font-medium">{point.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{point.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-white/10">
          <div className="mx-auto w-full max-w-6xl px-6 py-14">
            <h2 className="text-2xl font-semibold">Installer</h2>
            <ol className="mt-6 grid gap-3 md:grid-cols-2">
              {STEPS.map((step, index) => (
                <li key={step} className="flex gap-4 rounded-2xl border border-white/10 bg-zinc-950 p-4">
                  <span className="text-sm font-semibold text-red-600">{index + 1}</span>
                  <span className="text-sm text-zinc-300">{step}</span>
                </li>
              ))}
            </ol>
            {posters.length > 0 ? (
              <p className="mt-8 text-xs text-zinc-600">Affiches : TMDB</p>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
