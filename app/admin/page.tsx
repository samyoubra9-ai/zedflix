"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";

type AccountRow = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  expiresAt: string | null;
  expired: boolean;
  deviceBound: boolean;
  activeProfiles?: number;
  profileCount?: number;
};

type View = "overview" | "accounts" | "create";

type Dialog =
  | { kind: "delete"; user: AccountRow }
  | { kind: "extend"; user: AccountRow }
  | { kind: "release"; user: AccountRow }
  | { kind: "profiles"; user: AccountRow };

const MONTH_DURATIONS = [
  { months: 1, label: "1 mois" },
  { months: 3, label: "3 mois" },
  { months: 6, label: "6 mois" },
  { months: 12, label: "12 mois" },
];

const DAY_PRESETS = [3, 7, 14, 30] as const;

const NAV: { id: View; label: string; hint: string }[] = [
  { id: "overview", label: "Vue d’ensemble", hint: "Profils et expirations" },
  { id: "accounts", label: "Comptes", hint: "Profils, prolonger, délier" },
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
  const [createDays, setCreateDays] = useState("30");
  const [users, setUsers] = useState<AccountRow[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<View>("overview");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "expired">("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [extendDays, setExtendDays] = useState("3");
  const [busy, setBusy] = useState(false);

  const expired = users.filter((user) => user.expired).length;
  const profileActive = users.reduce((sum, user) => sum + (user.activeProfiles || 0), 0);
  const profileTotal = users.reduce((sum, user) => sum + (user.profileCount || 0), 0);
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
    const days = Number(createDays);
    if (!Number.isFinite(days) || days < 1) {
      setError("Indique une durée en jours (ex. 3, 30, 90)");
      return;
    }
    const response = await fetch("/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: userPassword, days }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || "Création impossible");
      return;
    }
    setEmail("");
    setUserPassword("");
    setCreateDays("30");
    setNotice(`Compte créé · profil Principal jusqu’au ${formatDate(body.expiresAt)}`);
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
    const days = Number(extendDays);
    if (!Number.isFinite(days) || days < 1) {
      setError("Indique une durée en jours");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    const response = await fetch(`/admin/users/${dialog.user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(body.error || "Prolongation impossible");
      return;
    }
    setNotice(`Tous les profils prolongés de ${days} j. · prochaine échéance ${formatDate(body.expiresAt)}`);
    setDialog(null);
    setExtendDays("3");
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
                <Stat label="Profils actifs" value={profileActive} tone="text-green-400" />
                <Stat label="Profils total" value={profileTotal} />
                <Stat label="Comptes sans profil actif" value={expired} tone="text-red-400" />
              </section>
              <section className="grid gap-4 lg:grid-cols-2">
                <Panel title="Expiration profil proche (≤ 7 j.)">
                  {expiringSoon.length === 0 ? (
                    <Empty>Aucun profil n’expire dans les 7 prochains jours.</Empty>
                  ) : (
                    expiringSoon.map((user) => (
                      <RowLine
                        key={user.id}
                        email={user.email}
                        detail={`Dans ${daysUntil(user.expiresAt)} j. · ${user.activeProfiles || 0}/${user.profileCount || 0} profils`}
                      />
                    ))
                  )}
                </Panel>
                <Panel title="Derniers comptes">
                  {users.length === 0 ? (
                    <Empty>Aucun compte pour le moment.</Empty>
                  ) : (
                    users.slice(0, 6).map((user) => (
                      <RowLine
                        key={user.id}
                        email={user.email}
                        detail={`${user.activeProfiles || 0}/${user.profileCount || 0} actifs · créé ${formatDate(user.createdAt)}`}
                      />
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
                <table className="w-full min-w-[1040px] text-left text-sm">
                  <thead className="text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Profils</th>
                      <th className="px-4 py-3 font-medium">Prochaine échéance</th>
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
                        <td className="px-4 py-3 text-zinc-300">
                          {user.activeProfiles || 0}
                          <span className="text-zinc-500"> / {user.profileCount || 0}</span>
                        </td>
                        <td className="px-4 py-3 text-zinc-300">
                          {formatDate(user.expiresAt)}
                          {daysUntil(user.expiresAt) !== null && daysUntil(user.expiresAt)! > 0 ? (
                            <span className="mt-0.5 block text-xs text-zinc-500">
                              {daysUntil(user.expiresAt)} j. restants
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-zinc-300">{user.deviceBound ? "Lié" : "Libre"}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs ${
                              user.expired ? "bg-red-950 text-red-300" : "bg-green-950 text-green-300"
                            }`}
                          >
                            {user.expired ? "Sans profil actif" : "OK"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setDialog({ kind: "profiles", user })}
                              className="rounded-lg border border-white/15 px-3 py-2 hover:bg-white/10"
                            >
                              Profils
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setExtendDays("3");
                                setDialog({ kind: "extend", user });
                              }}
                              className="rounded-lg border border-white/15 px-3 py-2 hover:bg-white/10"
                            >
                              + jours (tous)
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
              <p className="mt-1 text-sm text-zinc-400">
                Le compte reste à vie. Tu définis la durée du profil Principal en jours (ex. 3, 30, 90). Les autres
                profils se gèrent ensuite dans « Profils ».
              </p>
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
                  type="password"
                  required
                  minLength={8}
                  value={userPassword}
                  onChange={(event) => setUserPassword(event.target.value)}
                  className={`${fieldClass()} mt-2`}
                />
              </label>
              <div className="mt-4">
                <p className="text-sm text-zinc-400">Durée du profil Principal</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {DAY_PRESETS.map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setCreateDays(String(days))}
                      className={`rounded-lg px-3 py-2 text-xs ${
                        createDays === String(days)
                          ? "bg-red-600 text-white"
                          : "border border-white/15 text-zinc-300"
                      }`}
                    >
                      {days} jours
                    </button>
                  ))}
                  {MONTH_DURATIONS.map((duration) => (
                    <button
                      key={duration.months}
                      type="button"
                      onClick={() => setCreateDays(String(duration.months * 30))}
                      className={`rounded-lg px-3 py-2 text-xs ${
                        createDays === String(duration.months * 30)
                          ? "bg-red-600 text-white"
                          : "border border-white/15 text-zinc-300"
                      }`}
                    >
                      ~{duration.label}
                    </button>
                  ))}
                </div>
                <label className="mt-3 block text-sm text-zinc-400">
                  Ou saisis le nombre de jours
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    required
                    value={createDays}
                    onChange={(event) => setCreateDays(event.target.value)}
                    className={`${fieldClass()} mt-2`}
                  />
                </label>
              </div>
              <button className="mt-5 rounded-lg bg-red-600 px-4 py-3 font-medium" type="submit">
                Créer le compte
              </button>
            </form>
          ) : null}
        </main>
      </div>

      {dialog?.kind === "profiles" ? (
        <ProfileManager
          user={dialog.user}
          onClose={() => {
            setDialog(null);
            loadUsers().catch(() => undefined);
          }}
        />
      ) : null}

      {dialog && dialog.kind !== "profiles" ? (
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
                <h2 className="text-lg font-semibold">Prolonger tous les profils</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  {dialog.user.email} — chaque profil gagne le même nombre de jours. Si un profil est déjà expiré, on
                  repart d’aujourd’hui.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {DAY_PRESETS.map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setExtendDays(String(days))}
                      className={`rounded-lg px-3 py-2 text-xs ${
                        extendDays === String(days)
                          ? "bg-red-600 text-white"
                          : "border border-white/15 text-zinc-300"
                      }`}
                    >
                      +{days} j
                    </button>
                  ))}
                  {MONTH_DURATIONS.map((duration) => (
                    <button
                      key={duration.months}
                      type="button"
                      onClick={() => setExtendDays(String(duration.months * 30))}
                      className={`rounded-lg px-3 py-2 text-xs ${
                        extendDays === String(duration.months * 30)
                          ? "bg-red-600 text-white"
                          : "border border-white/15 text-zinc-300"
                      }`}
                    >
                      +{duration.label}
                    </button>
                  ))}
                </div>
                <label className="mt-4 block text-sm text-zinc-400">
                  Jours à ajouter
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={extendDays}
                    onChange={(event) => setExtendDays(event.target.value)}
                    className={`${fieldClass()} mt-2`}
                  />
                </label>
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

type ManagedProfile = {
  id: string;
  name: string;
  color: number;
  locked: boolean;
  expiresAt: string | null;
  expired: boolean;
  trialPending: boolean;
  daysLeft: number | null;
  warningMessage: string | null;
};

function profileStatusLabel(profile: ManagedProfile) {
  if (profile.trialPending) return "Essai 3 j. en attente";
  if (profile.expired) return "Expiré";
  if (profile.daysLeft !== null && profile.daysLeft <= 3) {
    return profile.daysLeft <= 1 ? "Expire bientôt" : `${profile.daysLeft} j. restants`;
  }
  return profile.expiresAt ? `Jusqu’au ${formatDate(profile.expiresAt)}` : "Actif";
}

function ProfileManager({ user, onClose }: { user: AccountRow; onClose: () => void }) {
  const [profiles, setProfiles] = useState<ManagedProfile[]>([]);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [createMode, setCreateMode] = useState<"trial" | "paid">("paid");
  const [createDays, setCreateDays] = useState("30");
  const [extendByProfile, setExtendByProfile] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, { name: string; pin: string }>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  async function load() {
    const response = await fetch(`/admin/users/${user.id}/profiles`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Impossible de charger les profils");
    const next = (body.profiles || []) as ManagedProfile[];
    setProfiles(next);
    setDrafts(Object.fromEntries(next.map((profile) => [profile.id, { name: profile.name, pin: "" }])));
    setExtendByProfile((current) => {
      const nextMap = { ...current };
      for (const profile of next) {
        if (!nextMap[profile.id]) nextMap[profile.id] = "3";
      }
      return nextMap;
    });
  }

  useEffect(() => {
    load().catch((cause: Error) => setError(cause.message));
  }, [user.id]);

  async function run(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erreur");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 px-6">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950 p-6">
        <h2 className="text-lg font-semibold">Profils de {user.email}</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Expiration par profil · tu saisis les jours (3, 7, 30…) · 5 profils max · 2 appareils / profil.
        </p>
        <div className="mt-5 space-y-3">
          {profiles.map((profile) => {
            const draft = drafts[profile.id] || { name: profile.name, pin: "" };
            const daysValue = extendByProfile[profile.id] || "3";
            return (
              <div key={profile.id} className="rounded-xl border border-white/10 p-3">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: cssColor(profile.color) }}
                  />
                  <span className="font-medium text-zinc-200">{profile.name}</span>
                  <span>{profile.locked ? "Code défini" : "Sans code"}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 ${
                      profile.expired
                        ? "bg-red-950 text-red-300"
                        : profile.trialPending
                          ? "bg-amber-950 text-amber-200"
                          : "bg-green-950 text-green-300"
                    }`}
                  >
                    {profileStatusLabel(profile)}
                  </span>
                </div>
                <input
                  value={draft.name}
                  maxLength={18}
                  onChange={(event) =>
                    setDrafts((current) => ({ ...current, [profile.id]: { ...draft, name: event.target.value } }))
                  }
                  className={fieldClass()}
                />
                <input
                  value={draft.pin}
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="Nouveau code"
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [profile.id]: { ...draft, pin: event.target.value.replace(/\D/g, "").slice(0, 4) },
                    }))
                  }
                  className={`${fieldClass()} mt-2`}
                />

                <div className="mt-3 rounded-lg border border-white/10 bg-black/40 p-3">
                  <p className="text-xs font-medium text-zinc-300">Prolonger ce profil</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {DAY_PRESETS.map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() =>
                          setExtendByProfile((current) => ({ ...current, [profile.id]: String(days) }))
                        }
                        className={`rounded-md px-2.5 py-1.5 text-[11px] ${
                          daysValue === String(days)
                            ? "bg-red-600 text-white"
                            : "border border-white/15 text-zinc-300"
                        }`}
                      >
                        +{days} j
                      </button>
                    ))}
                    {MONTH_DURATIONS.map((duration) => (
                      <button
                        key={duration.months}
                        type="button"
                        onClick={() =>
                          setExtendByProfile((current) => ({
                            ...current,
                            [profile.id]: String(duration.months * 30),
                          }))
                        }
                        className={`rounded-md px-2.5 py-1.5 text-[11px] ${
                          daysValue === String(duration.months * 30)
                            ? "bg-red-600 text-white"
                            : "border border-white/15 text-zinc-300"
                        }`}
                      >
                        +{duration.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      value={daysValue}
                      onChange={(event) =>
                        setExtendByProfile((current) => ({
                          ...current,
                          [profile.id]: event.target.value,
                        }))
                      }
                      className="w-24 rounded-lg border border-white/10 bg-black px-2 py-2 text-sm text-white"
                      aria-label="Jours à ajouter"
                    />
                    <span className="text-xs text-zinc-500">jours</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          const days = Number(daysValue);
                          if (!Number.isFinite(days) || days < 1) {
                            throw new Error("Indique un nombre de jours valide");
                          }
                          const response = await fetch(`/admin/users/${user.id}/profiles/${profile.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ extend: true, days }),
                          });
                          const body = await response.json();
                          if (!response.ok) throw new Error(body.error || "Prolongation impossible");
                        })
                      }
                      className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium disabled:opacity-50"
                    >
                      Prolonger
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const response = await fetch(`/admin/users/${user.id}/profiles/${profile.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ name: draft.name, pin: draft.pin }),
                        });
                        const body = await response.json();
                        if (!response.ok) throw new Error(body.error || "Modification impossible");
                      })
                    }
                    className="rounded-lg border border-white/15 px-3 py-2 text-sm disabled:opacity-50"
                  >
                    Enregistrer
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const response = await fetch(`/admin/users/${user.id}/profiles/${profile.id}`, {
                          method: "DELETE",
                        });
                        const body = await response.json();
                        if (!response.ok) throw new Error(body.error || "Suppression impossible");
                      })
                    }
                    className="rounded-lg border border-red-900 px-3 py-2 text-sm text-red-300 disabled:opacity-50"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            );
          })}
          {profiles.length === 0 ? <p className="text-sm text-zinc-500">Aucun profil.</p> : null}
        </div>
        {profiles.length < 5 ? (
          <form
            className="mt-5 border-t border-white/10 pt-5"
            onSubmit={(event) => {
              event.preventDefault();
              run(async () => {
                const payload =
                  createMode === "trial"
                    ? { name, pin, trial: true }
                    : { name, pin, days: Number(createDays) };
                if (createMode === "paid") {
                  const days = Number(createDays);
                  if (!Number.isFinite(days) || days < 1) {
                    throw new Error("Indique une durée en jours");
                  }
                }
                const response = await fetch(`/admin/users/${user.id}/profiles`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                });
                const body = await response.json();
                if (!response.ok) throw new Error(body.error || "Création impossible");
                setName("");
                setPin("");
              });
            }}
          >
            <p className="text-sm text-zinc-300">Nouveau profil</p>
            <input
              required
              maxLength={18}
              value={name}
              placeholder="Nom"
              onChange={(event) => setName(event.target.value)}
              className={`${fieldClass()} mt-3`}
            />
            <input
              required
              inputMode="numeric"
              maxLength={4}
              minLength={4}
              value={pin}
              placeholder="Code à 4 chiffres"
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
              className={`${fieldClass()} mt-2`}
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setCreateMode("paid")}
                className={`rounded-lg px-3 py-2 text-xs ${
                  createMode === "paid" ? "bg-red-600 text-white" : "border border-white/15 text-zinc-300"
                }`}
              >
                Durée (jours)
              </button>
              <button
                type="button"
                onClick={() => setCreateMode("trial")}
                className={`rounded-lg px-3 py-2 text-xs ${
                  createMode === "trial" ? "bg-red-600 text-white" : "border border-white/15 text-zinc-300"
                }`}
              >
                Essai auto 3 j.
              </button>
            </div>
            {createMode === "paid" ? (
              <>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {DAY_PRESETS.map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setCreateDays(String(days))}
                      className={`rounded-md px-2.5 py-1.5 text-[11px] ${
                        createDays === String(days)
                          ? "bg-white text-black"
                          : "border border-white/15 text-zinc-300"
                      }`}
                    >
                      {days} j
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={createDays}
                  onChange={(event) => setCreateDays(event.target.value)}
                  className={`${fieldClass()} mt-2`}
                  placeholder="Nombre de jours"
                />
              </>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">
                L’essai démarre au premier appareil. Un appareil déjà essayé ne peut pas relancer un essai.
              </p>
            )}
            <button
              type="submit"
              disabled={busy || pin.length !== 4}
              className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {busy ? "En cours…" : "Créer le profil"}
            </button>
          </form>
        ) : null}
        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-zinc-300">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function cssColor(color: number) {
  return `#${(color >>> 0).toString(16).padStart(8, "0").slice(2, 8)}`;
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
