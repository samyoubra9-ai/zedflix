"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useState } from "react";
import { catalogAccessOf, catalogAllowsPath, useSession } from "@/components/account";
import {
  IconFilm,
  IconList,
  IconLive,
  IconLogout,
  IconSearch,
  IconSwitch,
  IconTv,
} from "@/components/icons";
import { TvSpatialNav } from "./spatial-nav";

const NAV = [
  { href: "/search", label: "Recherche", Icon: IconSearch },
  { href: "/browse", label: "Films & Séries", Icon: IconFilm },
  { href: "/anime", label: "Animés", Icon: IconTv },
  { href: "/tv", label: "TV Live", Icon: IconLive },
  { href: "/list", label: "Ma liste", Icon: IconList },
] as const;

function colorCss(color: number) {
  const hex = (color >>> 0).toString(16).padStart(8, "0").slice(-6);
  return `#${hex}`;
}

function active(pathname: string, href: string) {
  if (href === "/browse") return pathname === "/browse";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Android-TV style chrome: left rail + focused content pane. */
export function TvShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useSession();
  const [expanded, setExpanded] = useState(false);

  async function switchProfile() {
    await fetch("/auth/web/profiles", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clear: true }),
    });
    router.replace("/profiles");
  }

  async function logout() {
    await fetch("/auth/web/logout", { method: "POST", credentials: "same-origin" });
    router.replace("/login");
  }

  return (
    <div className="tv-shell relative flex min-h-screen bg-[#050505] text-white">
      <TvSpatialNav enabled />

      <aside
        data-tv-zone="rail"
        className={`tv-rail sticky top-0 z-40 flex h-screen shrink-0 flex-col border-r border-white/5 bg-[#050505] transition-[width] duration-200 ${
          expanded ? "w-52" : "w-[4.75rem]"
        }`}
        onFocusCapture={() => setExpanded(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) setExpanded(false);
        }}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        <button
          type="button"
          data-tv-focus
          onClick={switchProfile}
          className="tv-focus mx-3 mt-5 flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-left outline-none"
          title="Changer de profil"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm font-bold text-white shadow-lg"
            style={{ background: profile ? colorCss(profile.color) : "#e50914" }}
          >
            {(profile?.name?.[0] || "M").toUpperCase()}
          </span>
          <span className={`min-w-0 ${expanded ? "opacity-100" : "pointer-events-none w-0 opacity-0"}`}>
            <span className="block truncate text-[13px] font-semibold">{profile?.name || "Profil"}</span>
            <span className="block text-[10px] text-zinc-400">Changer de profil</span>
          </span>
        </button>

        <nav className="mt-8 flex flex-1 flex-col gap-1.5 px-3">
          {NAV.filter(({ href }) => catalogAllowsPath(href, catalogAccessOf(profile))).map(({ href, label, Icon }) => {
            const isActive = active(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                data-tv-focus
                className={`tv-focus group flex items-center gap-3 rounded-xl px-2.5 py-3 outline-none transition ${
                  isActive ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className={`h-6 w-6 shrink-0 ${isActive ? "text-[#e50914]" : ""}`} />
                <span
                  className={`truncate text-sm font-medium transition ${
                    expanded ? "opacity-100" : "pointer-events-none w-0 opacity-0"
                  }`}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mb-5 flex flex-col gap-1 px-3">
          <button
            type="button"
            data-tv-focus
            onClick={switchProfile}
            className="tv-focus flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-zinc-400 outline-none hover:bg-white/5 hover:text-white"
          >
            <IconSwitch className="h-5 w-5 shrink-0" />
            <span className={`text-sm ${expanded ? "opacity-100" : "w-0 opacity-0"}`}>Profils</span>
          </button>
          <button
            type="button"
            data-tv-focus
            onClick={logout}
            className="tv-focus flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-zinc-400 outline-none hover:bg-white/5 hover:text-white"
          >
            <IconLogout className="h-5 w-5 shrink-0" />
            <span className={`text-sm ${expanded ? "opacity-100" : "w-0 opacity-0"}`}>Quitter</span>
          </button>
        </div>
      </aside>

      <div data-tv-zone="content" className="tv-pane relative min-w-0 flex-1 overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}
