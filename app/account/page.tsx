"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AccountGate,
  SiteNav,
  forgetWebProfile,
  forgetWebSession,
  rememberWebProfile,
  useSession,
} from "@/components/account";
import {
  IconDevices,
  IconLock,
  IconLogout,
  IconSettings,
  IconSwitch,
} from "@/components/icons";
import { ShellSkeleton } from "@/components/loading";
import { enrollBiometric, biometricAvailable } from "@/components/profile-prefs";

type Profile = { id: string; name: string; color: number; locked: boolean };
type Device = {
  id: string;
  name: string;
  current: boolean;
  lastSeen: number;
  profiles: { id: string; name: string }[];
};

const COLORS = [-1767148, -4711132, -14725511, -13669553, -10732178];

function colorCss(color: number) {
  const hex = (color >>> 0).toString(16).padStart(8, "0").slice(-6);
  return `#${hex}`;
}

function formatSeen(at: number) {
  if (!at) return "—";
  const diff = Date.now() - at;
  if (diff < 60_000) return "À l’instant";
  if (diff < 3_600_000) return `Il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `Il y a ${Math.floor(diff / 3_600_000)} h`;
  return new Date(at).toLocaleDateString("fr-FR");
}

export default function AccountPage() {
  return (
    <AccountGate>
      <AccountSettings />
    </AccountGate>
  );
}

function AccountSettings() {
  const router = useRouter();
  const { email, profile } = useSession();
  const [devices, setDevices] = useState<Device[]>([]);
  const [current, setCurrent] = useState<Profile | null>(profile);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [bioOk, setBioOk] = useState(false);

  const [name, setName] = useState(profile?.name || "");
  const [color, setColor] = useState(profile?.color || COLORS[0]);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  async function reload() {
    const response = await fetch("/auth/web/account", { credentials: "same-origin" });
    const data = (await response.json()) as {
      email?: string;
      profile?: Profile | null;
      devices?: Device[];
      error?: string;
    };
    if (!response.ok) {
      setStatus(data.error || "Impossible de charger le compte");
      setLoading(false);
      return;
    }
    setDevices(data.devices || []);
    if (data.profile) {
      setCurrent(data.profile);
      setName(data.profile.name);
      setColor(data.profile.color);
      rememberWebProfile(data.profile);
    }
    setLoading(false);
  }

  useEffect(() => {
    reload();
    biometricAvailable().then(setBioOk);
  }, []);

  async function switchProfile() {
    await fetch("/auth/web/profiles", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clear: true }),
    });
    forgetWebProfile();
    router.replace("/profiles");
  }

  async function logout() {
    await fetch("/auth/web/logout", { method: "POST", credentials: "same-origin" });
    forgetWebSession();
    router.replace("/login");
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!current) return;
    setBusy(true);
    setStatus("Enregistrement…");
    const response = await fetch(`/auth/web/profiles/${current.id}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    const data = (await response.json()) as { profile?: Profile; error?: string };
    setBusy(false);
    if (!response.ok) {
      setStatus(data.error || "Impossible d’enregistrer");
      return;
    }
    if (data.profile) {
      setCurrent(data.profile);
      rememberWebProfile(data.profile);
    }
    setStatus("Profil mis à jour");
  }

  async function savePin(event: FormEvent) {
    event.preventDefault();
    if (!current) return;
    if (newPin && newPin !== confirmPin) {
      setStatus("Les codes ne correspondent pas");
      return;
    }
    if (newPin && !/^\d{4}$/.test(newPin)) {
      setStatus("Le code doit contenir 4 chiffres");
      return;
    }
    setBusy(true);
    setStatus("Mise à jour du code…");
    const response = await fetch(`/auth/web/profiles/${current.id}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPin: current.locked ? currentPin : undefined,
        pin: newPin || undefined,
        clearPin: !newPin && current.locked,
      }),
    });
    const data = (await response.json()) as { profile?: Profile; error?: string };
    setBusy(false);
    if (!response.ok) {
      setStatus(data.error || "Impossible de changer le code");
      return;
    }
    if (data.profile) {
      setCurrent(data.profile);
      rememberWebProfile(data.profile);
    }
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setStatus(newPin ? "Code mis à jour" : "Code retiré");
  }

  async function revoke(deviceId: string) {
    setBusy(true);
    const response = await fetch("/auth/web/account", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke-device", deviceId }),
    });
    setBusy(false);
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setStatus(data.error || "Impossible de déconnecter l’appareil");
      return;
    }
    setStatus("Appareil déconnecté");
    reload();
  }

  async function enableBio() {
    if (!current) return;
    setBusy(true);
    setStatus("Active la biométrie…");
    const ok = await enrollBiometric(current.id);
    setBusy(false);
    setStatus(ok ? "Biométrie activée pour ce profil" : "Biométrie indisponible sur cet appareil");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white">
        <SiteNav />
        <ShellSkeleton />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 pb-28 pt-20 text-white sm:px-8 sm:pb-16 sm:pt-24 md:px-12">
      <SiteNav />
      <div className="mx-auto max-w-2xl space-y-8">
        <header>
          <p className="text-sm font-semibold tracking-[0.18em] text-zinc-500">COMPTE</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Réglages</h1>
          <p className="mt-2 truncate text-sm text-zinc-400">{email}</p>
        </header>

        {status ? (
          <p className="rounded-xl bg-white/5 px-4 py-3 text-sm text-zinc-300 ring-1 ring-white/10">
            {status}
          </p>
        ) : null}

        <section className="rounded-2xl border border-white/10 bg-zinc-950/80 p-5 sm:p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
            <IconSettings className="h-4 w-4" />
            Profil
          </div>
          <form onSubmit={saveProfile} className="mt-5 space-y-4">
            <div className="flex items-center gap-4">
              <span
                className="flex h-14 w-14 items-center justify-center rounded-lg text-xl font-bold"
                style={{ background: colorCss(color) }}
              >
                {(name[0] || "?").toUpperCase()}
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value.slice(0, 18))}
                className="h-12 flex-1 rounded-lg bg-zinc-900 px-4 outline-none ring-1 ring-white/10 focus:ring-white/25"
                placeholder="Nom du profil"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((tint) => (
                <button
                  key={tint}
                  type="button"
                  onClick={() => setColor(tint)}
                  className={`h-9 w-9 rounded-full ring-2 ${
                    color === tint ? "ring-white" : "ring-transparent"
                  }`}
                  style={{ background: colorCss(tint) }}
                  aria-label="Couleur"
                />
              ))}
            </div>
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="h-11 rounded-lg bg-white px-5 text-sm font-semibold text-black disabled:opacity-40"
            >
              Enregistrer le profil
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-white/10 bg-zinc-950/80 p-5 sm:p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
            <IconLock className="h-4 w-4" />
            Code PIN
          </div>
          <p className="mt-2 text-sm text-zinc-500">
            {current?.locked ? "Ce profil est protégé par un code." : "Aucun code pour l’instant."}
          </p>
          <form onSubmit={savePin} className="mt-5 space-y-3">
            {current?.locked ? (
              <input
                inputMode="numeric"
                maxLength={4}
                value={currentPin}
                onChange={(event) => setCurrentPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="Code actuel"
                className="h-12 w-full rounded-lg bg-zinc-900 px-4 tracking-[0.3em] outline-none ring-1 ring-white/10 focus:ring-white/25"
              />
            ) : null}
            <input
              inputMode="numeric"
              maxLength={4}
              value={newPin}
              onChange={(event) => setNewPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder={current?.locked ? "Nouveau code (vide = retirer)" : "Nouveau code à 4 chiffres"}
              className="h-12 w-full rounded-lg bg-zinc-900 px-4 tracking-[0.3em] outline-none ring-1 ring-white/10 focus:ring-white/25"
            />
            <input
              inputMode="numeric"
              maxLength={4}
              value={confirmPin}
              onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="Confirmer le code"
              className="h-12 w-full rounded-lg bg-zinc-900 px-4 tracking-[0.3em] outline-none ring-1 ring-white/10 focus:ring-white/25"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={busy}
                className="h-11 rounded-lg bg-red-600 px-5 text-sm font-semibold disabled:opacity-40"
              >
                {newPin ? "Changer le code" : current?.locked ? "Retirer le code" : "Définir un code"}
              </button>
              {bioOk && current ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={enableBio}
                  className="h-11 rounded-lg bg-white/10 px-5 text-sm font-medium disabled:opacity-40"
                >
                  Activer biométrie
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-white/10 bg-zinc-950/80 p-5 sm:p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
            <IconDevices className="h-4 w-4" />
            Appareils
          </div>
          <ul className="mt-4 divide-y divide-white/10">
            {devices.map((device) => (
              <li key={device.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {device.name}
                    {device.current ? (
                      <span className="ml-2 rounded bg-red-600/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
                        CET APPAREIL
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {formatSeen(device.lastSeen)}
                    {device.profiles.length
                      ? ` · ${device.profiles.map((item) => item.name).join(", ")}`
                      : ""}
                  </p>
                </div>
                {!device.current ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => revoke(device.id)}
                    className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium"
                  >
                    Déconnecter
                  </button>
                ) : null}
              </li>
            ))}
            {!devices.length ? (
              <li className="py-3 text-sm text-zinc-500">Aucun appareil enregistré.</li>
            ) : null}
          </ul>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={switchProfile}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white/10 text-sm font-medium"
          >
            <IconSwitch className="h-4 w-4" />
            Changer de profil
          </button>
          <button
            type="button"
            onClick={logout}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-red-600 text-sm font-semibold"
          >
            <IconLogout className="h-4 w-4" />
            Se déconnecter
          </button>
        </section>
      </div>
    </main>
  );
}
