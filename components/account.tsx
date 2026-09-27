"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { DetailRoot } from "./detail";
import { PlayerSkeleton, ShellSkeleton } from "./loading";

type ProfileInfo = { id: string; name: string; color: number; locked: boolean };
type SessionState = { email: string; profile: ProfileInfo | null };

/** null = not checked yet; false = logged out; object = logged in */
let sessionCache: SessionState | false | null = null;

function activeSession(): SessionState | null {
  if (sessionCache === null || sessionCache === false) return null;
  return sessionCache;
}

export function rememberWebSession(email: string) {
  const current = activeSession();
  sessionCache = { email, profile: current?.profile ?? null };
}

export function rememberWebProfile(profile: ProfileInfo) {
  const current = activeSession();
  sessionCache = { email: current?.email ?? "", profile };
}

export function forgetWebProfile() {
  const current = activeSession();
  if (current) sessionCache = { ...current, profile: null };
}

export function forgetWebSession() {
  sessionCache = false;
}

export function useSession() {
  const initial = activeSession();
  const [email, setEmail] = useState(initial?.email ?? "");
  const [profile, setProfile] = useState<ProfileInfo | null>(initial?.profile ?? null);
  const [ready, setReady] = useState(sessionCache !== null);

  useEffect(() => {
    let stop = false;
    async function load() {
      const response = await fetch("/auth/web/session", { credentials: "same-origin" });
      const data = (await response.json()) as {
        email?: string;
        profile?: ProfileInfo | null;
      };
      if (stop) return;
      if (response.ok && data.email) {
        sessionCache = {
          email: data.email,
          profile: data.profile || null,
        };
        setEmail(data.email);
        setProfile(data.profile || null);
      } else {
        sessionCache = false;
        setEmail("");
        setProfile(null);
      }
      setReady(true);
    }
    load();
    const timer = window.setInterval(load, 10 * 60 * 1000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, []);

  return { email, profile, ready };
}

export function AccountGate({
  children,
  player = false,
}: {
  children: ReactNode;
  player?: boolean;
}) {
  const { email, profile, ready } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!ready) return;
    if (!email) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!profile) {
      router.replace("/profiles");
    }
  }, [ready, email, profile, pathname, router]);

  if (!ready || !email || !profile) {
    if (player) return <PlayerSkeleton />;
    return (
      <main className="min-h-screen bg-black text-white">
        <SiteNav />
        <ShellSkeleton />
      </main>
    );
  }
  return <DetailRoot>{children}</DetailRoot>;
}

const LINKS = [
  { href: "/browse", label: "Accueil" },
  { href: "/films", label: "Films" },
  { href: "/series", label: "Séries" },
  { href: "/search", label: "Recherche" },
];

function colorCss(color: number) {
  const hex = (color >>> 0).toString(16).padStart(8, "0").slice(-6);
  return `#${hex}`;
}

export function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useSession();

  async function logout() {
    await fetch("/auth/web/logout", { method: "POST", credentials: "same-origin" });
    forgetWebSession();
    router.replace("/login");
  }

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

  return (
    <header className="fixed inset-x-0 top-0 z-30 flex items-center gap-6 bg-gradient-to-b from-black via-black/80 to-transparent px-6 py-4 md:px-12">
      <Link href="/browse" className="text-2xl font-bold tracking-tight text-red-600">
        MINUIT
      </Link>
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`hidden text-sm sm:inline ${pathname === link.href ? "font-semibold text-white" : "text-zinc-300"}`}
        >
          {link.label}
        </Link>
      ))}
      <div className="ml-auto flex items-center gap-3">
        {profile ? (
          <button
            type="button"
            onClick={switchProfile}
            className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-zinc-200 hover:bg-white/10"
            title="Changer de profil"
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded text-xs font-bold text-white"
              style={{ background: colorCss(profile.color) }}
            >
              {(profile.name[0] || "?").toUpperCase()}
            </span>
            <span className="hidden max-w-[8rem] truncate md:inline">{profile.name}</span>
          </button>
        ) : null}
        <button type="button" onClick={logout} className="text-sm text-zinc-300">
          Sortir
        </button>
      </div>
    </header>
  );
}
