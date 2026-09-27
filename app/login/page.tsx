"use client";

import { FormEvent, Suspense, useState } from "react";
import { rememberWebSession } from "@/components/account";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("Connexion…");
    const response = await fetch("/auth/web/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email, password }),
    });
    const data = (await response.json()) as { email?: string; error?: string };
    if (!response.ok) {
      setStatus(data.error || "Connexion impossible");
      return;
    }
    rememberWebSession(data.email || email.trim().toLowerCase());
    window.location.assign("/profiles");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-white">
      <form onSubmit={onSubmit} className="w-full max-w-md">
        <div className="flex items-center gap-3">
          <img src="/mark.png" alt="" className="h-10 w-10 rounded-xl" />
          <p className="text-3xl font-bold tracking-tight text-red-600">MINUIT</p>
        </div>
        <h1 className="mt-8 text-3xl font-semibold">Connexion</h1>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          className="mt-8 h-12 w-full rounded bg-zinc-800 px-4 outline-none"
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Mot de passe"
          className="mt-3 h-12 w-full rounded bg-zinc-800 px-4 outline-none"
        />
        <button type="submit" className="mt-6 h-12 w-full rounded bg-red-600 font-semibold">
          Entrer
        </button>
        {status ? <p className="mt-4 text-sm text-zinc-300">{status}</p> : null}

        <a
          href="/minuit.apk"
          className="mt-8 flex h-12 w-full items-center justify-center rounded bg-white text-sm font-semibold text-black"
        >
          Télécharger l’app
        </a>
      </form>
    </main>
  );
}
