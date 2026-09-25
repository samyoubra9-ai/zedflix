"use client";

import { FormEvent, useEffect, useState } from "react";

type AccountRow = {
  id: string;
  email: string;
  createdAt: string;
  expiresAt: string | null;
  expired: boolean;
};

const DURATIONS = [
  { months: 1, label: "1 mois" },
  { months: 3, label: "3 mois" },
  { months: 6, label: "6 mois" },
  { months: 12, label: "12 mois" },
];

function formatDate(value: string | null) {
  if (!value) return "Sans date";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));
}

export default function AdminPage() {
  const [ready, setReady] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [months, setMonths] = useState(1);
  const [users, setUsers] = useState<AccountRow[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const active = users.filter((user) => !user.expired).length;
  const expired = users.length - active;

  async function loadUsers() {
    const response = await fetch("/admin/users");
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Impossible de charger les comptes");
    setUsers(body.users || []);
  }

  useEffect(() => {
    fetch("/admin/session")
      .then((response) => response.json())
      .then(async (body) => {
        setAdmin(Boolean(body.admin));
        if (body.admin) await loadUsers();
      })
      .catch((cause: Error) => setError(cause.message))
      .finally(() => setReady(true));
  }, []);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || "Mot de passe incorrect");
      return;
    }
    setAdmin(true);
    setPassword("");
    await loadUsers();
  }

  async function createUser(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    const response = await fetch("/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: userPassword, months }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || "Création impossible");
      return;
    }
    setEmail("");
    setUserPassword("");
    setMonths(1);
    setNotice(`Compte créé pour ${body.email}`);
    await loadUsers();
  }

  if (!ready) {
    return <main className="mx-auto w-full max-w-5xl px-6 py-16 text-zinc-400">Chargement…</main>;
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <div>
        <p className="text-sm font-semibold tracking-[0.2em] text-red-600">ZEDFLIX</p>
        <h1 className="mt-2 text-3xl font-semibold">Administration</h1>
      </div>

      {error ? <p className="text-red-600">{error}</p> : null}
      {notice ? <p className="text-green-600">{notice}</p> : null}

      {!admin ? (
        <form onSubmit={signIn} className="flex max-w-sm flex-col gap-3">
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mot de passe admin"
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3"
          />
          <button className="rounded-md bg-red-600 px-4 py-3 font-medium text-white" type="submit">
            Entrer
          </button>
        </form>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <p className="text-sm text-zinc-400">Comptes</p>
              <p className="mt-2 text-3xl font-semibold">{users.length}</p>
            </article>
            <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <p className="text-sm text-zinc-400">Actifs</p>
              <p className="mt-2 text-3xl font-semibold text-green-500">{active}</p>
            </article>
            <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <p className="text-sm text-zinc-400">Expirés</p>
              <p className="mt-2 text-3xl font-semibold text-red-500">{expired}</p>
            </article>
          </section>

          <form onSubmit={createUser} className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 md:grid-cols-4">
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              className="rounded-md border border-zinc-700 bg-black px-3 py-3"
            />
            <input
              type="text"
              required
              minLength={8}
              value={userPassword}
              onChange={(event) => setUserPassword(event.target.value)}
              placeholder="Mot de passe"
              className="rounded-md border border-zinc-700 bg-black px-3 py-3"
            />
            <select
              value={months}
              onChange={(event) => setMonths(Number(event.target.value))}
              className="rounded-md border border-zinc-700 bg-black px-3 py-3"
            >
              {DURATIONS.map((duration) => (
                <option key={duration.months} value={duration.months}>
                  {duration.label}
                </option>
              ))}
            </select>
            <button className="rounded-md bg-red-600 px-4 py-3 font-medium text-white" type="submit">
              Créer le compte
            </button>
          </form>

          <div className="overflow-hidden rounded-xl border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-950 text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Créé</th>
                  <th className="px-4 py-3 font-medium">Expire</th>
                  <th className="px-4 py-3 font-medium">État</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-zinc-800">
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3">{formatDate(user.expiresAt)}</td>
                    <td className="px-4 py-3">{user.expired ? "Expiré" : "Actif"}</td>
                  </tr>
                ))}
                {users.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-zinc-500" colSpan={4}>
                      Aucun compte
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
