"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { forgetWebSession, rememberWebSession, rememberWebProfile, forgetWebProfile } from "@/components/account";
import { Spinner } from "@/components/loading";

type Profile = {
  id: string;
  name: string;
  color: number;
  locked: boolean;
};

function colorCss(color: number) {
  const hex = (color >>> 0).toString(16).padStart(8, "0").slice(-6);
  return `#${hex}`;
}

export default function ProfilesPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [unlock, setUnlock] = useState<Profile | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let stop = false;
    fetch("/auth/web/session", { credentials: "same-origin" })
      .then(async (response) => {
        const data = (await response.json()) as {
          email?: string;
          profiles?: Profile[];
          profile?: Profile | null;
          error?: string;
        };
        if (stop) return;
        if (!response.ok || !data.email) {
          router.replace("/login?next=/profiles");
          return;
        }
        rememberWebSession(data.email);
        setEmail(data.email);
        setProfiles(data.profiles || []);
        setLoading(false);
      })
      .catch(() => {
        if (!stop) router.replace("/login?next=/profiles");
      });
    return () => {
      stop = true;
    };
  }, [router]);

  async function choose(profile: Profile, code = "") {
    if (profile.locked && code.length !== 4) {
      setUnlock(profile);
      setPin("");
      setStatus("");
      return;
    }
    setBusy(true);
    setStatus(profile.locked ? "Vérification…" : "Ouverture…");
    const response = await fetch("/auth/web/profiles", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: profile.id, pin: code }),
    });
    const data = (await response.json()) as { profile?: Profile; error?: string };
    setBusy(false);
    if (!response.ok) {
      setStatus(data.error || "Impossible d’ouvrir ce profil");
      setPin("");
      return;
    }
    rememberWebProfile(data.profile || profile);
    window.location.assign("/browse");
  }

  function onPinSubmit(event: FormEvent) {
    event.preventDefault();
    if (!unlock || pin.length !== 4 || busy) return;
    choose(unlock, pin);
  }

  async function signOut() {
    await fetch("/auth/web/logout", { method: "POST", credentials: "same-origin" });
    forgetWebSession();
    forgetWebProfile();
    router.replace("/login");
  }

  const initials = useMemo(
    () =>
      profiles.map((profile) => ({
        ...profile,
        letter: (profile.name.trim()[0] || "?").toUpperCase(),
        tint: colorCss(profile.color),
      })),
    [profiles],
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <Spinner className="h-12 w-12" />
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-black px-6 text-white">
      <button
        type="button"
        onClick={signOut}
        className="absolute right-6 top-6 text-sm text-zinc-400 hover:text-white"
      >
        Se déconnecter
      </button>

      <p className="text-3xl font-bold tracking-tight text-red-600">MINUIT</p>
      <h1 className="mt-10 text-center text-3xl font-semibold sm:text-5xl">Qui regarde ?</h1>
      <p className="mt-3 text-sm text-zinc-400">{email}</p>

      {initials.length ? (
        <ul className="mt-12 flex max-w-4xl flex-wrap justify-center gap-8">
          {initials.map((profile) => (
            <li key={profile.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => choose(profile)}
                className="group w-28 text-center sm:w-36"
              >
                <span
                  className="relative mx-auto flex aspect-square w-full items-center justify-center rounded-md text-4xl font-bold text-white shadow-lg ring-2 ring-transparent transition group-hover:ring-white sm:text-5xl"
                  style={{ background: profile.tint }}
                >
                  {profile.letter}
                  {profile.locked ? (
                    <span className="absolute bottom-2 right-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium tracking-wide">
                      PIN
                    </span>
                  ) : null}
                </span>
                <span className="mt-3 block truncate text-sm text-zinc-300 group-hover:text-white">
                  {profile.name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-12 max-w-md text-center text-zinc-400">
          Aucun profil sur ce compte. Demande à l’admin d’en créer un.
        </p>
      )}

      {status && !unlock ? <p className="mt-8 text-sm text-zinc-400">{status}</p> : null}

      {unlock ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/80 px-4">
          <form
            onSubmit={onPinSubmit}
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl"
          >
            <p className="text-sm text-zinc-400">Code pour</p>
            <h2 className="mt-1 text-2xl font-semibold">{unlock.name}</h2>
            <input
              autoFocus
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="••••"
              className="mt-6 h-14 w-full rounded-lg bg-zinc-900 text-center text-2xl tracking-[0.4em] outline-none ring-1 ring-white/10 focus:ring-white/30"
            />
            {status ? <p className="mt-3 text-sm text-red-400">{status}</p> : null}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setUnlock(null);
                  setPin("");
                  setStatus("");
                }}
                className="h-11 flex-1 rounded-lg bg-white/10 text-sm font-medium"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={pin.length !== 4 || busy}
                className="h-11 flex-1 rounded-lg bg-red-600 text-sm font-semibold disabled:opacity-40"
              >
                Entrer
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
