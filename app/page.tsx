export default function Home() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center gap-8 px-6 py-16">
      <div>
        <p className="text-sm font-semibold tracking-[0.2em] text-red-600">ZEDFLIX</p>
        <h1 className="mt-3 text-4xl font-semibold">Télécharge l’application</h1>
        <p className="mt-3 text-zinc-400">
          Installe le fichier sur ton téléphone, puis autorise l’installation.
        </p>
      </div>
      <a
        href="/zedflix.apk"
        className="rounded-md bg-red-600 px-5 py-4 text-center text-lg font-medium text-white"
      >
        Télécharger Zedflix
      </a>
    </main>
  );
}
