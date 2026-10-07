import type { Metadata } from "next";
import { FootPlayer } from "@/components/foot-player";
import { listFootGroups, type FootGroup } from "@/lib/foot-play";

export const metadata: Metadata = {
  title: "Foot — Minuit",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FootPage() {
  let groups: FootGroup[] = [];
  let failed = false;
  try {
    groups = await listFootGroups();
    if (!groups.length) failed = true;
  } catch {
    failed = true;
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Foot</h1>
        <p className="mt-2 max-w-md text-sm text-zinc-400">
          beIN Arab en premier, puis les chaînes françaises. Tu en choisis une.
        </p>
      </header>
      {failed ? (
        <p className="text-sm text-zinc-300">Les chaînes n&apos;ont pas pu être chargées. Réessaie dans un moment.</p>
      ) : (
        <FootPlayer groups={groups} />
      )}
    </main>
  );
}
