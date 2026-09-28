"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconAndroid, IconTv } from "@/components/icons";

const NAV = [
  { label: "Accueil", href: "/" },
  { label: "Séries", href: "/#series" },
  { label: "Films", href: "/#films" },
  { label: "Nouveau", href: "/#trending" },
  { label: "Continuer", href: "/#ma-liste" },
];

export function SiteHeader({ solid: solidProp = false }: { solid?: boolean }) {
  const [solid, setSolid] = useState(solidProp);

  useEffect(() => {
    if (solidProp) {
      setSolid(true);
      return;
    }
    const onScroll = () => setSolid(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [solidProp]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background,box-shadow] duration-300 ${
        solid
          ? "bg-[#050505]/95 shadow-[0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md"
          : "bg-gradient-to-b from-black/80 to-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-6 px-4 sm:px-8 lg:px-12">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mark.png" alt="" className="h-8 w-8 rounded-lg" />
          <span className="text-[15px] font-bold tracking-[0.28em] text-white">
            MINUIT
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-[13px] text-zinc-400 transition hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <a
            href="/minuit.apk"
            className="hidden items-center gap-1.5 rounded-md bg-[#e50914] px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-[#f6121d] sm:inline-flex"
          >
            <IconAndroid className="h-3.5 w-3.5" />
            Android
          </a>
          <a
            href="/minuit-tv.apk"
            className="hidden items-center gap-1.5 rounded-md bg-white/15 px-3 py-2 text-[12px] font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/25 sm:inline-flex"
          >
            <IconTv className="h-3.5 w-3.5" />
            Android TV
          </a>
          <div className="flex h-8 w-8 items-center justify-center rounded bg-zinc-800 text-xs font-semibold text-zinc-200 ring-1 ring-white/10">
            M
          </div>
        </div>
      </div>
    </header>
  );
}
