"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";

type AccountRow = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  expiresAt: string | null;
  expired: boolean;
  deviceBound: boolean;
};

type View = "overview" | "accounts" | "create";

type Dialog =
  | { kind: "delete"; user: AccountRow }
  | { kind: "extend"; user: AccountRow }
  | { kind: "release"; user: AccountRow };

const DURATIONS = [
  { months: 1, label: "1 mois" },
  { months: 3, label: "3 mois" },
  { months: 6, label: "6 mois" },
  { months: 12, label: "12 mois" },
];

const NAV: { id: View; label: string; hint: string }[] = [
  { id: "overview", label: "Vue d’ensemble", hint: "Activité des comptes" },
  { id: "accounts", label: "Comptes", hint: "Prolonger, délier, supprimer" },
  { id: "create", label: "Nouveau compte", hint: "Créer un accès" },
];

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));
}

function daysUntil(value: string | null) {
  if (!value) return null;
  return Math.ceil((Date.parse(value) - Date.now()) / 86_400_000);
}

function fieldClass() {
  return "w-full rounded-lg border border-white/10 bg-black px-3 py-3 text-white outline-none placeholder:text-zinc-500 focus:border-red-600";
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
  const [view, setView] = useState<View>("overview");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "expired">("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [extendMonths, setExtendMonths] = useState(1);
  const [busy, setBusy] = useState(false);

  const active = users.filter((user) => !user.expired).length;
  const expired = users.length - active;
  const expiringSoon = useMemo(
    () =>
      users.filter((user) => {
        const days = daysUntil(user.expiresAt);
        return days !== null && days > 0 && days <= 7;
      }),
    [users],
  );
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return users.filter((user) => {
      if (filter === "active" && user.expired) return false;
      if (filter === "expired" && !user.expired) return false;
      return !needle || user.email.toLowerCase().includes(needle);
    });
  }, [users, query, filter]);

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
    setView("overview");
    await loadUsers();
  }

  async function signOut() {
    await fetch("/admin/session", { method: "DELETE" });
    setAdmin(false);
    setUsers([]);
    setMenuOpen(false);
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
    setView("accounts");
  }

  async function removeUser() {
    if (dialog?.kind !== "delete") return;
    setBusy(true);
    setError("");
    setNotice("");
    const response = await fetch(`/admin/users/${dialog.user.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(body.error || "Suppression impossible");
      return;
    }
    setNotice(`Compte supprimé : ${dialog.user.email}`);
    setDialog(null);
    await loadUsers();
  }

  async function extendUser() {
    if (dialog?.kind !== "extend") return;
    setBusy(true);
    setError("");
    setNotice("");
    const response = await fetch(`/admin/users/${dialog.user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ months: extendMonths }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(body.error || "Prolongation impossible");
      return;
    }
    setNotice(`Compte prolongé jusqu’au ${formatDate(body.expiresAt)}`);
    setDialog(null);
    setExtendMonths(1);
    await loadUsers();
  }

  async function releaseUser() {
    if (dialog?.kind !== "release") return;
    setBusy(true);
    setError("");
    setNotice("");
    const response = await fetch(`/admin/users/${dialog.user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ releaseDevice: true }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(body.error || "Impossible de délier l’appareil");
      return;
    }
    setNotice(`Appareil délié pour ${dialog.user.email}`);
    setDialog(null);
    await loadUsers();
  }

  function openView(next: View) {
    setView(next);
    setMenuOpen(false);
    setError("");
  }

  if (!ready) {
    return <main className="grid min-h-screen place-items-center bg-[#070707] text-zinc-400">Chargement…</main>;
  }

  if (!admin) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#070707] px-6 text-white">
        <form onSubmit={signIn} className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-950 p-6">
          <p className="text-sm font-semibold tracking-[0.2em] text-red-600">MINUIT</p>
          <h1 className="mt-3 text-2xl font-semibold">Administration</h1>
          <p className="mt-2 text-sm text-zinc-400">Entre le mot de passe pour ouvrir le tableau de bord.</p>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mot de passe admin"
            className={`${fieldClass()} mt-6`}
          />
          {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
          <button className="mt-4 w-full rounded-lg bg-red-600 px-4 py-3 font-medium" type="submit">
            Entrer
          </button>
        </form>
      </main>
    );
  }

  const title = NAV.find((item) => item.id === view);

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      {menuOpen ? (
        <button
          aria-label="Fermer le menu"
          className="fixed inset-0 z-20 bg-black/60 md:hidden"
          onClick={() => setMenuOpen(false)}
          type="button"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-white/10 bg-[#101010] transition-transform ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        <div className="border-b border-white/10 px-5 py-6">
          <p className="text-sm font-semibold tracking-[0.22em] text-red-600">MINUIT</p>
          <p className="mt-1 text-sm text-zinc-400">Tableau de bord</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV.map((item) => {
            const selected = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => openView(item.id)}
                className={`rounded-lg px-3 py-3 text-left ${
                  selected ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="block text-sm font-medium">{item.label}</span>
                <span className="mt-0.5 block text-xs text-zinc-500">{item.hint}</span>
              </button>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={signOut}
            className="w-full rounded-lg px-3 py-3 text-left text-sm text-zinc-400 hover:bg-white/5 hover:text-white"
          >
            Se déconnecter
          </button>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg border border-white/10 px-3 py-2 text-sm md:hidden"
              onClick={() => setMenuOpen(true)}
            >
              Menu
            </button>
            <div>
              <h1 className="text-xl font-semibold">{title?.label}</h1>
              <p className="text-sm text-zinc-500">{title?.hint}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openView("create")}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium"
          >
            Nouveau compte
          </button>
        </header>

        <main className="flex flex-col gap-6 px-5 py-6 md:px-8">
          {error ? <p className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">{error}</p> : null}
          {notice ? <p className="rounded-lg border border-green-900 bg-green-950/40 px-4 py-3 text-sm text-green-300">{notice}</p> : null}

          {view === "overview" ? (
            <>
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Stat label="Comptes" value={users.length} />
                <Stat label="Actifs" value={active} tone="text-green-400" />
                <Stat label="Expirés" value={expired} tone="text-red-400" />
                <Stat label="Expirent sous 7 jours" value={expiringSoon.length} tone="text-amber-300" />
              </section>
              <section className="grid gap-4 lg:grid-cols-2">
                <Panel title="Expiration proche">
                  {expiringSoon.length === 0 ? (
                    <Empty>Aucun compte n’expire dans les 7 prochains jours.</Empty>
                  ) : (
                    expiringSoon.map((user) => (
                      <RowLine
                        key={user.id}
                        email={user.email}
                        detail={`Expire dans ${daysUntil(user.expiresAt)} jour${daysUntil(user.expiresAt) === 1 ? "" : "s"}`}
                      />
                    ))
                  )}
                </Panel>
                <Panel title="Derniers comptes">
                  {users.length === 0 ? (
                    <Empty>Aucun compte pour le moment.</Empty>
                  ) : (
                    users.slice(0, 6).map((user) => (
                      <RowLine key={user.id} email={user.email} detail={`Créé le ${formatDate(user.createdAt)}`} />
                    ))
                  )}
                </Panel>
              </section>
            </>
          ) : null}

          {view === "accounts" ? (
            <section className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
              <div className="flex flex-col gap-3 border-b border-white/10 p-4 md:flex-row md:items-center">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Rechercher un email"
                  className={fieldClass()}
                />
                <div className="flex gap-2">
                  {(
                    [
                      ["all", "Tous"],
                      ["active", "Actifs"],
                      ["expired", "Expirés"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFilter(id)}
                      className={`rounded-lg px-3 py-2 text-sm ${
                        filter === id ? "bg-white text-black" : "bg-white/5 text-zinc-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Créé</th>
                      <th className="px-4 py-3 font-medium">Expire</th>
                      <th className="px-4 py-3 font-medium">Appareil</th>
                      <th className="px-4 py-3 font-medium">État</th>
                      <th className="px-4 py-3 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((user) => (
                      <tr key={user.id} className="border-t border-white/10">
                        <td className="px-4 py-3">
                          <p>{user.email}</p>
                          <p className="text-xs text-zinc-500">Vu le {formatDate(user.lastSignInAt)}</p>
                        </td>
                        <td className="px-4 py-3 text-zinc-300">{formatDate(user.createdAt)}</td>
                        <td className="px-4 py-3 text-zinc-300">{formatDate(user.expiresAt)}</td>
                        <td className="px-4 py-3 text-zinc-300">{user.deviceBound ? "Lié" : "Libre"}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs ${
                              user.expired ? "bg-red-950 text-red-300" : "bg-green-950 text-green-300"
                            }`}
                          >
                            {user.expired ? "Expiré" : "Actif"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setExtendMonths(1);
                                setDialog({ kind: "extend", user });
                              }}
                              className="rounded-lg border border-white/15 px-3 py-2 hover:bg-white/10"
                            >
                              Prolonger
                            </button>
                            <button
                              type="button"
                              disabled={!user.deviceBound}
                              onClick={() => setDialog({ kind: "release", user })}
                              className="rounded-lg border border-white/15 px-3 py-2 hover:bg-white/10 disabled:cursor-default disabled:opacity-40"
                            >
                              Délier
                            </button>
                            <button
                              type="button"
                              onClick={() => setDialog({ kind: "delete", user })}
                              className="rounded-lg border border-red-900 px-3 py-2 text-red-300 hover:bg-red-950"
                            >
                              Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {visible.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8 text-zinc-500" colSpan={6}>
                          Aucun compte ne correspond.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {view === "create" ? (
            <form onSubmit={createUser} className="max-w-xl rounded-2xl border border-white/10 bg-zinc-950 p-5">
              <h2 className="text-lg font-medium">Créer un accès</h2>
              <p className="mt-1 text-sm text-zinc-400">Le compte est confirmé tout de suite et lié à une durée.</p>
              <label className="mt-5 block text-sm text-zinc-400">
                Email
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={`${fieldClass()} mt-2`}
                />
              </label>
              <label className="mt-4 block text-sm text-zinc-400">
                Mot de passe
                <input
                  type="text"
                  required
                  minLength={8}
                  value={userPassword}
                  onChange={(event) => setUserPassword(event.target.value)}
                  className={`${fieldClass()} mt-2`}
                />
              </label>
              <label className="mt-4 block text-sm text-zinc-400">
                Durée
                <select
                  value={months}
                  onChange={(event) => setMonths(Number(event.target.value))}
                  className={`${fieldClass()} mt-2`}
                >
                  {DURATIONS.map((duration) => (
                    <option key={duration.months} value={duration.months}>
                      {duration.label}
                    </option>
                  ))}
                </select>
              </label>
              <button className="mt-5 rounded-lg bg-red-600 px-4 py-3 font-medium" type="submit">
                Créer le compte
              </button>
            </form>
          ) : null}
        </main>
      </div>

      {dialog ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 px-6">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6">
            {dialog.kind === "delete" ? (
              <>
                <h2 className="text-lg font-semibold">Supprimer ce compte ?</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  {dialog.user.email} perd l’accès immédiatement. Cette action est définitive.
                </p>
              </>
            ) : null}
            {dialog.kind === "extend" ? (
              <>
                <h2 className="text-lg font-semibold">Prolonger {dialog.user.email}</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Le temps restant est conservé. Si le compte est déjà expiré, la nouvelle durée part d’aujourd’hui.
                </p>
                <select
                  value={extendMonths}
                  onChange={(event) => setExtendMonths(Number(event.target.value))}
                  className={`${fieldClass()} mt-4`}
                >
                  {DURATIONS.map((duration) => (
                    <option key={duration.months} value={duration.months}>
                      {duration.label}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            {dialog.kind === "release" ? (
              <>
                <h2 className="text-lg font-semibold">Délier l’appareil ?</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  {dialog.user.email} pourra se connecter sur un nouveau téléphone. L’ancien sera déconnecté.
                </p>
              </>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDialog(null)}
                disabled={busy}
                className="rounded-lg px-4 py-2 text-sm text-zinc-300"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={dialog.kind === "delete" ? removeUser : dialog.kind === "extend" ? extendUser : releaseUser}
                disabled={busy}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium disabled:opacity-60"
              >
                {busy
                  ? "En cours…"
                  : dialog.kind === "delete"
                    ? "Supprimer"
                    : dialog.kind === "extend"
                      ? "Prolonger"
                      : "Délier"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, tone = "text-white" }: { label: string; value: number; tone?: string }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-zinc-950 p-4">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${tone}`}>{value}</p>
    </article>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-zinc-950">
      <h2 className="border-b border-white/10 px-4 py-3 text-sm font-medium text-zinc-300">{title}</h2>
      <div className="divide-y divide-white/10">{children}</div>
    </section>
  );
}

function RowLine({ email, detail }: { email: string; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <p className="truncate text-sm">{email}</p>
      <p className="shrink-0 text-xs text-zinc-500">{detail}</p>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-sm text-zinc-500">{children}</p>;
}
