"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  forgetWebSession,
  rememberWebSession,
  rememberWebProfile,
  forgetWebProfile,
  catalogAccessOf,
  catalogHome,
} from "@/components/account";
import { Spinner } from "@/components/loading";
import { PinPad, clearPinLock, notePinFail, usePinLockCountdown } from "@/components/pin-pad";
import { saveLastProfileId } from "@/components/profile-prefs";

type Profile = {
  id: string;
  name: string;
  color: number;
  locked: boolean;
  expired?: boolean;
  trialPending?: boolean;
  daysLeft?: number | null;
  warning?: "soon" | "urgent" | "expired" | null;
  warningMessage?: string | null;
  catalogAccess?: "full" | "vod" | "live";
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
  const [trust, setTrust] = useState(true);
  const [busy, setBusy] = useState(false);
  const lock = usePinLockCountdown(unlock?.id || null);

  useEffect(() => {
    let stop = false;
    fetch("/auth/web/session", { credentials: "same-origin" })
      .then(async (response) => {
        const data = (await response.json()) as {
          email?: string;
          profiles?: Profile[];
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function choose(profile: Profile, code = "", preferTrust = false) {
    if (profile.expired) {
      setStatus(profile.warningMessage || "Ce profil a expiré");
      return;
    }
    if (profile.locked && code.length !== 4 && !preferTrust) {
      setUnlock(profile);
      setPin("");
      setStatus("");
      return;
    }
    if (profile.locked && code.length === 4 && lock.locked) {
      setStatus(`Trop d’essais. Réessaie dans ${lock.seconds}s`);
      return;
    }
    setBusy(true);
    setStatus(profile.locked && code ? "Vérification…" : "Ouverture…");
    const response = await fetch("/auth/web/profiles", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId: profile.id,
        pin: code,
        trust: trust || preferTrust,
      }),
    });
    const data = (await response.json()) as { profile?: Profile; error?: string };
    setBusy(false);
    if (!response.ok) {
      if (response.status === 403 && profile.locked && code) {
        const fail = notePinFail(profile.id);
        setStatus(
          fail.locked
            ? `Trop d’essais. Réessaie dans ${Math.ceil((fail.until - Date.now()) / 1000)}s`
            : data.error || "Code incorrect",
        );
      } else if (preferTrust && !code) {
        setUnlock(profile);
        setStatus("");
      } else {
        setStatus(data.error || "Impossible d’ouvrir ce profil");
      }
      setPin("");
      return;
    }
    clearPinLock(profile.id);
    saveLastProfileId(profile.id);
    const opened = data.profile || profile;
    rememberWebProfile(opened);
    window.location.assign(catalogHome(catalogAccessOf(opened)));
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
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-black px-4 py-16 text-white sm:px-6">
      <button
        type="button"
        onClick={signOut}
        className="absolute right-4 top-5 text-sm text-zinc-400 hover:text-white sm:right-6 sm:top-6"
      >
        Se déconnecter
      </button>

      <p className="text-2xl font-bold tracking-tight text-red-600 sm:text-3xl">MINUIT</p>
      <h1 className="mt-8 text-center text-2xl font-semibold sm:mt-10 sm:text-5xl">Qui regarde ?</h1>
      <p className="mt-3 max-w-full truncate px-4 text-sm text-zinc-400">{email}</p>

      {initials.some((profile) => profile.warningMessage && !profile.expired) ? (
        <p className="mt-4 max-w-lg rounded-xl border border-amber-500/25 bg-amber-950/40 px-4 py-3 text-center text-sm text-amber-100">
          {initials.find((profile) => profile.warningMessage && !profile.expired)?.warningMessage}
        </p>
      ) : null}

      {initials.length ? (
        <ul className="mt-10 flex max-w-4xl flex-wrap justify-center gap-5 sm:mt-12 sm:gap-8">
          {initials.map((profile) => (
            <li key={profile.id}>
              <button
                type="button"
                disabled={busy || Boolean(profile.expired)}
                onClick={() => choose(profile)}
                className="group w-24 text-center sm:w-36 disabled:opacity-45"
              >
                <span
                  className="relative mx-auto flex aspect-square w-full items-center justify-center rounded-md text-3xl font-bold text-white shadow-lg ring-2 ring-transparent transition group-hover:ring-white sm:text-5xl"
                  style={{ background: profile.tint }}
                >
                  {profile.letter}
                  {profile.locked ? (
                    <span className="absolute bottom-2 right-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium tracking-wide">
                      PIN
                    </span>
                  ) : null}
                  {profile.expired ? (
                    <span className="absolute inset-x-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-red-200">
                      Expiré
                    </span>
                  ) : profile.trialPending ? (
                    <span className="absolute inset-x-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-amber-100">
                      Essai
                    </span>
                  ) : null}
                </span>
                <span className="mt-3 block truncate text-sm text-zinc-300 group-hover:text-white">
                  {profile.name}
                </span>
                {profile.daysLeft !== null && profile.daysLeft !== undefined && !profile.expired && !profile.trialPending ? (
                  <span className="mt-1 block text-[11px] text-zinc-500">
                    {profile.daysLeft <= 3 ? `${profile.daysLeft} j. restants` : null}
                  </span>
                ) : null}
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
        <PinPad
          name={unlock.name}
          value={pin}
          onChange={setPin}
          busy={busy || lock.locked}
          trust={trust}
          onTrustChange={setTrust}
          status={
            lock.locked
              ? `Trop d’essais. Réessaie dans ${lock.seconds}s`
              : status
          }
          onCancel={() => {
            setUnlock(null);
            setPin("");
            setStatus("");
          }}
          onSubmit={(code) => {
            if (lock.locked) return;
            choose(unlock, code);
          }}
        />
      ) : null}
    </main>
  );
}
