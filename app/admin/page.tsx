"use client";

import { FormEvent, useEffect, useState } from "react";

type AccountRow = { id: string; email: string; createdAt: string };

export default function AdminPage() {
  const [ready, setReady] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [users, setUsers] = useState<AccountRow[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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
      body: JSON.stringify({ email, password: userPassword }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || "Création impossible");
      return;
    }
    setEmail("");
    setUserPassword("");
    setNotice(`Compte créé pour ${body.email}`);
    await loadUsers();
  }

  if (!ready) return <main className="mx-auto w-full max-w-lg px-6 py-16">Chargement…</main>;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-8 px-6 py-16">
      <div>
        <p className="text-sm font-semibold tracking-wide text-red-600">ZEDFLIX</p>
        <h1 className="mt-2 text-3xl font-semibold">Administration</h1>
        <p className="mt-2 text-zinc-500">Crée les comptes. L’application ne sert qu’à se connecter.</p>
      </div>

      {error ? <p className="text-red-600">{error}</p> : null}
      {notice ? <p className="text-green-600">{notice}</p> : null}

      {!admin ? (
        <form onSubmit={signIn} className="flex flex-col gap-3">
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mot de passe admin"
            className="rounded-md border border-zinc-300 bg-transparent px-3 py-3"
          />
          <button className="rounded-md bg-red-600 px-4 py-3 font-medium text-white" type="submit">
            Entrer
          </button>
        </form>
      ) : (
        <>
          <form onSubmit={createUser} className="flex flex-col gap-3">
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email du compte"
              className="rounded-md border border-zinc-300 bg-transparent px-3 py-3"
            />
            <input
              type="text"
              required
              minLength={8}
              value={userPassword}
              onChange={(event) => setUserPassword(event.target.value)}
              placeholder="Mot de passe, 8 caractères minimum"
              className="rounded-md border border-zinc-300 bg-transparent px-3 py-3"
            />
            <button className="rounded-md bg-red-600 px-4 py-3 font-medium text-white" type="submit">
              Créer le compte
            </button>
          </form>
          <ul className="flex flex-col gap-2">
            {users.map((user) => (
              <li key={user.id} className="rounded-md border border-zinc-200 px-3 py-2">
                {user.email}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
