"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useRef, useState } from "react";
import { DetailRoot } from "./detail";
import {
  IconFilm,
  IconHome,
  IconList,
  IconLogout,
  IconSearch,
  IconSettings,
  IconSwitch,
  IconTv,
  IconUser,
} from "./icons";
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
  const [expired, setExpired] = useState(false);

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
        setExpired(false);
      } else {
        sessionCache = false;
        setEmail("");
        setProfile(null);
        if (response.status === 401) setExpired(true);
      }
      setReady(true);
    }
    load();
    const timer = window.setInterval(load, 5 * 60 * 1000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, []);

  return { email, profile, ready, expired };
}

export function AccountGate({
  children,
  player = false,
}: {
  children: ReactNode;
  player?: boolean;
}) {
  const { email, profile, ready, expired } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [elsewhere, setElsewhere] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!email) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}${expired ? "&expired=1" : ""}`);
      return;
    }
    if (!profile) {
      router.replace("/profiles");
    }
  }, [ready, email, profile, pathname, router, expired]);

  useEffect(() => {
    if (!ready || !email || !profile) return;
    let stop = false;
    async function check() {
      const response = await fetch("/auth/web/presence", { credentials: "same-origin" });
      if (stop) return;
      if (response.status === 401) {
        forgetWebSession();
        router.replace(`/login?next=${encodeURIComponent(pathname)}&expired=1`);
        return;
      }
      const data = (await response.json()) as { profile?: boolean };
      if (response.ok && data.profile === false) setElsewhere(true);
      else setElsewhere(false);
    }
    check();
    const timer = window.setInterval(check, 25_000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [ready, email, profile, pathname, router]);

  async function leaveProfile() {
    await fetch("/auth/web/profiles", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clear: true }),
    });
    forgetWebProfile();
    router.replace("/profiles");
  }

  if (!ready || !email || !profile) {
    if (player) return <PlayerSkeleton />;
    return (
      <main className="min-h-screen bg-black text-white">
        <SiteNav />
        <ShellSkeleton />
      </main>
    );
  }

  return (
    <DetailRoot>
      {elsewhere ? (
        <div className="fixed inset-x-0 top-14 z-50 px-4 sm:top-16 sm:px-8 md:px-12">
          <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-950/90 px-4 py-3 text-sm text-amber-50 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <p>Ce profil est utilisé sur un autre appareil.</p>
            <button
              type="button"
              onClick={leaveProfile}
              className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black"
            >
              Changer de profil
            </button>
          </div>
        </div>
      ) : null}
      {children}
    </DetailRoot>
  );
}

const LINKS = [
  { href: "/browse", label: "Accueil", Icon: IconHome },
  { href: "/films", label: "Films", Icon: IconFilm },
  { href: "/series", label: "Séries", Icon: IconTv },
  { href: "/list", label: "Ma liste", Icon: IconList },
  { href: "/search", label: "Recherche", Icon: IconSearch },
] as const;

function colorCss(color: number) {
  const hex = (color >>> 0).toString(16).padStart(8, "0").slice(-6);
  return `#${hex}`;
}

function linkActive(pathname: string, href: string) {
  if (href === "/browse") return pathname === "/browse";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, email } = useSession();
  const [open, setOpen] = useState(false);
  const [solid, setSolid] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    function onScroll() {
      setSolid(window.scrollY > 24);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function logout() {
    await fetch("/auth/web/logout", { method: "POST", credentials: "same-origin" });
    forgetWebSession();
    router.replace("/login");
  }

  async function switchProfile() {
    setOpen(false);
    await fetch("/auth/web/profiles", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clear: true }),
    });
    forgetWebProfile();
    router.replace("/profiles");
  }

  const desktopLinks = LINKS.filter((link) => link.href !== "/search");

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-40 pt-[env(safe-area-inset-top)] transition-colors duration-300 ${
          solid
            ? "bg-black/95 backdrop-blur-md"
            : "bg-gradient-to-b from-black via-black/80 to-transparent"
        }`}
      >
        <div className="flex h-14 items-center gap-3 px-4 sm:h-16 sm:gap-6 sm:px-8 md:px-12">
          <Link href="/browse" className="text-xl font-bold tracking-tight text-red-600 sm:text-2xl">
            MINUIT
          </Link>

          <nav className="ml-2 hidden items-center gap-5 md:flex">
            {desktopLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`text-sm transition ${
                  linkActive(pathname, href) ? "font-semibold text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                {label}
              </Link>
            ))}
            <Link
              href="/search"
              className={`text-sm transition ${
                linkActive(pathname, "/search") ? "font-semibold text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              Recherche
            </Link>
          </nav>

          <div className="relative ml-auto" ref={menuRef}>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="flex items-center gap-2 rounded-full bg-white/5 px-2 py-1.5 ring-1 ring-white/10 hover:bg-white/10"
              aria-expanded={open}
              aria-haspopup="menu"
            >
              {profile ? (
                <span
                  className="flex h-7 w-7 items-center justify-center rounded text-xs font-bold text-white"
                  style={{ background: colorCss(profile.color) }}
                >
                  {(profile.name[0] || "?").toUpperCase()}
                </span>
              ) : (
                <span className="rounded-full p-1 text-zinc-400">
                  <IconUser className="h-4 w-4" />
                </span>
              )}
              <span className="hidden max-w-[8rem] truncate text-sm text-zinc-200 lg:inline">
                {profile?.name || "Compte"}
              </span>
            </button>

            {open ? (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-zinc-950/95 py-1 shadow-2xl backdrop-blur"
              >
                {email ? (
                  <p className="truncate px-3 py-2 text-xs text-zinc-500">{email}</p>
                ) : null}
                <Link
                  href="/list"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 text-sm text-zinc-200 hover:bg-white/5"
                >
                  <IconList className="h-4 w-4" />
                  Ma liste
                </Link>
                <Link
                  href="/account"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 text-sm text-zinc-200 hover:bg-white/5"
                >
                  <IconSettings className="h-4 w-4" />
                  Compte & sécurité
                </Link>
                <button
                  type="button"
                  onClick={switchProfile}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-zinc-200 hover:bg-white/5"
                >
                  <IconSwitch className="h-4 w-4" />
                  Changer de profil
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-400 hover:bg-white/5"
                >
                  <IconLogout className="h-4 w-4" />
                  Se déconnecter
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid h-[3.75rem] grid-cols-5">
          {LINKS.map(({ href, label, Icon }) => {
            const active = linkActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center gap-0.5 text-[9px] font-medium transition ${
                  active ? "text-white" : "text-zinc-500"
                }`}
              >
                <span
                  className={`rounded-xl px-2.5 py-1 ${active ? "bg-red-600/15 text-red-500" : ""}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
