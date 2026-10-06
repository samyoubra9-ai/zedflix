"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useRef, useState } from "react";
import { DetailRoot } from "./detail";
import {
  IconFilm,
  IconList,
  IconLive,
  IconLogout,
  IconMoon,
  IconSearch,
  IconSettings,
  IconSwitch,
  IconTv,
  IconUser,
} from "./icons";
import { PlayerSkeleton, ShellSkeleton } from "./loading";
import { LanguageSwitch, useCopy } from "@/components/locale";
import { useTvMode } from "@/hooks/use-tv-mode";
import { TvShell } from "@/components/tv/tv-shell";

type ProfileInfo = {
  id: string;
  name: string;
  color: number;
  locked: boolean;
  warningMessage?: string | null;
  daysLeft?: number | null;
  catalogAccess?: "full" | "vod" | "live";
};

export type CatalogAccess = "full" | "vod" | "live";

export function catalogAccessOf(profile: { catalogAccess?: string } | null | undefined): CatalogAccess {
  if (profile?.catalogAccess === "vod" || profile?.catalogAccess === "live") return profile.catalogAccess;
  return "full";
}

function shortExpiry(message: string) {
  const days = message.match(/(\d+)\s+jour/);
  if (days) return `Expire dans ${days[1]} j.`;
  if (/demain/i.test(message)) return "Expire demain";
  if (/aujourd/i.test(message)) return "Expire aujourd’hui";
  if (/essai/i.test(message)) return "Essai 3 jours";
  if (/expir/i.test(message)) return "Profil expiré";
  return message.length > 36 ? `${message.slice(0, 34)}…` : message;
}

export function catalogHome(access: CatalogAccess) {
  return access === "live" ? "/tv" : "/browse";
}

export type CatalogTab = "stream" | "anime" | "live" | "turkey";

export function rememberCatalogTab(tab: CatalogTab) {
  try {
    sessionStorage.setItem("minuit_catalog", tab);
  } catch {
    /* private mode */
  }
}

export function currentCatalogTab(): CatalogTab {
  try {
    const value = sessionStorage.getItem("minuit_catalog");
    if (value === "anime" || value === "live" || value === "stream" || value === "turkey") return value;
  } catch {
    /* private mode */
  }
  return "stream";
}

export function catalogAllowsPath(pathname: string, access: CatalogAccess) {
  if (pathname.startsWith("/account") || pathname.startsWith("/profiles")) return true;
  if (access === "full") return true;
  const live =
    pathname === "/tv" || pathname.startsWith("/tv/") || pathname.startsWith("/watch/live");
  if (access === "live") return live;
  return !live;
}
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
  const tv = useTvMode();
  const [elsewhere, setElsewhere] = useState(false);
  const [expiryNotice, setExpiryNotice] = useState<string | null>(null);
  const [expiryDismissed, setExpiryDismissed] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!email) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}${expired ? "&expired=1" : ""}`);
      return;
    }
    if (!profile) {
      router.replace("/profiles");
      return;
    }
    if (!catalogAllowsPath(pathname, catalogAccessOf(profile))) {
      router.replace(catalogHome(catalogAccessOf(profile)));
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
      const data = (await response.json()) as {
        profile?: boolean;
        expired?: boolean;
        released?: boolean;
        warningMessage?: string | null;
      };
      if (response.ok && data.expired) {
        forgetWebProfile();
        router.replace("/profiles?expired=1");
        return;
      }
      if (response.ok && data.released) {
        forgetWebProfile();
        router.replace("/profiles");
        return;
      }
      if (response.ok && data.profile === false) setElsewhere(true);
      else setElsewhere(false);
      const notice = data.warningMessage || null;
      setExpiryNotice(notice);
      if (notice) {
        try {
          setExpiryDismissed(sessionStorage.getItem("minuit_expiry_dismiss") === notice);
        } catch {
          setExpiryDismissed(false);
        }
      }
    }
    check();
    const timer = window.setInterval(check, 60_000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [ready, email, profile, pathname, router]);

  useEffect(() => {
    if (!ready || !email || !profile) return;
    let timer = 0;
    let released = false;
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        window.clearTimeout(timer);
        released = false;
        timer = window.setTimeout(() => {
          released = true;
          void fetch("/auth/web/profiles", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clear: true }),
          });
          forgetWebProfile();
        }, 60_000);
        return;
      }
      window.clearTimeout(timer);
      if (released) {
        released = false;
        forgetWebProfile();
        router.replace("/profiles");
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearTimeout(timer);
    };
  }, [ready, email, profile, router]);

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
        {tv ? null : <SiteNav />}
        <ShellSkeleton />
      </main>
    );
  }

  const content = (
    <>
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
      ) : expiryNotice && !player && !expiryDismissed ? (
        <div className="pointer-events-none fixed bottom-[5.5rem] right-3 z-40 md:bottom-6 md:right-6">
          <div className="pointer-events-auto flex max-w-[15rem] items-center gap-2 rounded-full bg-black/85 py-1 pl-3 pr-1 text-[11px] text-zinc-200 shadow-lg ring-1 ring-white/15 backdrop-blur">
            <span className="truncate">{shortExpiry(expiryNotice)}</span>
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => {
                setExpiryDismissed(true);
                try {
                  sessionStorage.setItem("minuit_expiry_dismiss", expiryNotice);
                } catch {
                  /* private mode */
                }
              }}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-sm text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
      {children}
    </>
  );

  return (
    <DetailRoot>
      {tv && !player ? <TvShell>{content}</TvShell> : content}
    </DetailRoot>
  );
}

const LINKS = [
  { href: "/browse", label: "Films & Séries", Icon: IconFilm },
  { href: "/anime", label: "Animés", Icon: IconTv },
  { href: "/turquie", label: "Turquie", Icon: IconMoon },
  { href: "/tv", label: "TV Live", Icon: IconLive },
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
  const copy = useCopy();
  const { profile, email } = useSession();
  const tv = useTvMode();
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

  if (tv) return null;

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

  const access = catalogAccessOf(profile);
  const labelOf = (href: string) =>
    href === "/browse"
      ? copy.films
      : href === "/anime"
        ? copy.anime
        : href === "/turquie"
          ? copy.turkey
          : href === "/tv"
            ? copy.live
            : href === "/list"
              ? copy.list
              : copy.search;
  const links = LINKS.filter((link) => catalogAllowsPath(link.href, access));
  const desktopLinks = links.filter((link) => link.href !== "/search");

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
          <Link href={catalogHome(access)} className="text-xl font-bold tracking-tight text-red-600 sm:text-2xl">
            MINUIT
          </Link>

          <nav className="ml-2 hidden items-center gap-5 md:flex">
            {desktopLinks.map(({ href }) => (
              <Link
                key={href}
                href={href}
                className={`text-sm transition ${
                  linkActive(pathname, href) ? "font-semibold text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                {labelOf(href)}
              </Link>
            ))}
            <Link
              href="/search"
              className={`text-sm transition ${
                linkActive(pathname, "/search") ? "font-semibold text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              {copy.search}
            </Link>
          </nav>

          <div className="relative ml-auto flex items-center gap-2" ref={menuRef}>
            <LanguageSwitch />
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
                  {copy.list}
                </Link>
                <Link
                  href="/account"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 text-sm text-zinc-200 hover:bg-white/5"
                >
                  <IconSettings className="h-4 w-4" />
                  {copy.account}
                </Link>
                <button
                  type="button"
                  onClick={switchProfile}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-zinc-200 hover:bg-white/5"
                >
                  <IconSwitch className="h-4 w-4" />
                  {copy.switchProfile}
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-400 hover:bg-white/5"
                >
                  <IconLogout className="h-4 w-4" />
                  {copy.logout}
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
        <div
          className="grid h-[3.75rem]"
          style={{ gridTemplateColumns: `repeat(${Math.max(links.length, 1)}, minmax(0, 1fr))` }}
        >
          {links.map(({ href, Icon }) => {
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
                {labelOf(href)}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
