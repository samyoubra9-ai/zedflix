"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { rememberWebSession } from "@/components/account";
import { IconAndroid, IconTv } from "@/components/icons";
import { TELEGRAM_ESSAI_URL } from "@/lib/telegram-public";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [status, setStatus] = useState(
    search.get("expired") === "1" ? "Session expirée — reconnecte-toi." : "",
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("Connexion…");
    const response = await fetch("/auth/web/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email, password, remember }),
    });
    const data = (await response.json()) as { email?: string; error?: string };
    if (!response.ok) {
      setStatus(data.error || "Connexion impossible");
      return;
    }
    rememberWebSession(data.email || email.trim().toLowerCase());
    const next = search.get("next");
    window.location.assign(next && next.startsWith("/") ? next : "/profiles");
  }

  return (
    <main className="relative flex min-h-screen flex-col bg-[#050505] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(229,9,20,0.18),_transparent_55%)]" />

      <header className="relative z-10 flex items-center px-5 py-5 sm:px-8">
        <img src="/mark.png" alt="" className="h-9 w-9 rounded-xl sm:h-10 sm:w-10" />
        <span className="ml-3 text-sm font-semibold tracking-[0.22em]">MINUIT</span>
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 pb-8 sm:px-6">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-md rounded-2xl border border-white/10 bg-black/50 p-5 shadow-2xl backdrop-blur sm:p-8"
        >
          <h1 className="text-2xl font-semibold sm:text-3xl">Connexion</h1>
          <p className="mt-2 text-sm text-zinc-400">Accède à ton catalogue Minuit.</p>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            autoComplete="email"
            className="mt-7 h-12 w-full rounded-lg bg-zinc-900 px-4 outline-none ring-1 ring-white/10 focus:ring-white/25"
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mot de passe"
            autoComplete="current-password"
            className="mt-3 h-12 w-full rounded-lg bg-zinc-900 px-4 outline-none ring-1 ring-white/10 focus:ring-white/25"
          />
          <label className="mt-4 flex items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-zinc-900"
            />
            Se souvenir de moi
          </label>
          <button
            type="submit"
            className="mt-6 h-12 w-full rounded-lg bg-red-600 font-semibold transition hover:bg-red-500"
          >
            Entrer
          </button>
          {status ? <p className="mt-4 text-sm text-zinc-300">{status}</p> : null}
          <p className="mt-5 text-center text-sm text-zinc-500">
            Pas de compte ?{" "}
            <a
              href={TELEGRAM_ESSAI_URL}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
            >
              Demander un essai 3&nbsp;jours
            </a>
          </p>
        </form>
      </div>

      <footer className="relative z-10 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8">
        <div className="mx-auto flex w-full max-w-md flex-col gap-2 sm:flex-row">
          <a
            href="/minuit.apk"
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-white text-sm font-semibold text-black"
          >
            <IconAndroid className="h-4 w-4" />
            Android
          </a>
          <a
            href="/minuit-tv.apk"
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-white/15 text-sm font-semibold text-white ring-1 ring-white/20"
          >
            <IconTv className="h-4 w-4" />
            Android TV
          </a>
        </div>
        <p className="mx-auto mt-2 max-w-md text-center text-[11px] text-zinc-500">
          Téléphone / tablette · Box &amp; Smart TV Android
        </p>
      </footer>
    </main>
  );
}
