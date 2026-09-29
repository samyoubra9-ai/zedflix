"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { IconAndroid, IconDownload, IconLive, IconTv } from "@/components/icons";
import { TELEGRAM_BOT_USERNAME, TELEGRAM_ESSAI_URL } from "@/lib/telegram-public";

type Backdrop = { title: string; backdrop: string };
type Poster = { title: string; poster: string };

function QrCode({ value }: { value: string }) {
  const src = useMemo(() => {
    const params = new URLSearchParams({
      size: "220x220",
      data: value,
      bgcolor: "050505",
      color: "ffffff",
      margin: "1",
      qzone: "1",
    });
    return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`;
  }, [value]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="QR code Minuit"
      width={220}
      height={220}
      className="h-[11.5rem] w-[11.5rem] rounded-xl bg-black/80 p-2 ring-1 ring-white/15"
    />
  );
}

function HeroStage({ backdrops }: { backdrops: Backdrop[] }) {
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);
  const slides = backdrops.slice(0, 8);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => {
      setFade(false);
      window.setTimeout(() => {
        setIndex((current) => (current + 1) % slides.length);
        setFade(true);
      }, 420);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  if (!slides.length) {
    return <div className="absolute inset-0 bg-[#050505]" />;
  }

  return (
    <div className="absolute inset-0 overflow-hidden">
      {slides.map((slide, slideIndex) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={slide.backdrop}
          src={slide.backdrop}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            slideIndex === index && fade ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/35" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-black/40 to-black/55" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#050505] to-transparent" />
    </div>
  );
}

function PosterWall({ posters }: { posters: Poster[] }) {
  const rowA = posters.slice(0, 12);
  const rowB = posters.slice(12, 24);
  if (!rowA.length) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[42%] overflow-hidden opacity-[0.42]">
      <div className="vitrine-marquee flex w-max gap-3 py-2">
        {[...rowA, ...rowA].map((item, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`a-${item.poster}-${i}`}
            src={item.poster}
            alt=""
            className="h-40 w-[6.75rem] shrink-0 rounded-md object-cover shadow-2xl ring-1 ring-white/10 sm:h-48 sm:w-32"
          />
        ))}
      </div>
      {rowB.length ? (
        <div className="vitrine-marquee-reverse mt-3 flex w-max gap-3 py-2">
          {[...rowB, ...rowB].map((item, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`b-${item.poster}-${i}`}
              src={item.poster}
              alt=""
              className="h-36 w-[6.1rem] shrink-0 rounded-md object-cover shadow-2xl ring-1 ring-white/10 sm:h-44 sm:w-[7.5rem]"
            />
          ))}
        </div>
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/55 to-transparent" />
      <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#050505] to-transparent sm:w-40" />
      <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#050505] to-transparent sm:w-40" />
    </div>
  );
}

export function Vitrine() {
  const [origin, setOrigin] = useState("");
  const [backdrops, setBackdrops] = useState<Backdrop[]>([]);
  const [posters, setPosters] = useState<Poster[]>([]);

  useEffect(() => {
    setOrigin(window.location.origin);
    let stop = false;
    fetch("/api/vitrine")
      .then(async (response) => {
        const data = (await response.json()) as {
          backdrops?: Backdrop[];
          posters?: Poster[];
        };
        if (stop || !response.ok) return;
        setBackdrops(data.backdrops || []);
        setPosters(data.posters || []);
      })
      .catch(() => undefined);
    return () => {
      stop = true;
    };
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050505] text-white">
      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-5 sm:px-10 lg:px-14">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mark.png" alt="" className="h-9 w-9 rounded-xl shadow-lg shadow-black/50" />
          <span className="text-sm font-semibold tracking-[0.28em] drop-shadow">MINUIT</span>
        </div>
        <Link
          href="/login"
          className="rounded-full bg-black/40 px-4 py-2 text-sm font-medium text-zinc-100 ring-1 ring-white/15 backdrop-blur transition hover:bg-black/60"
        >
          Connexion
        </Link>
      </header>

      <section className="relative isolate min-h-[100svh] overflow-hidden">
        <HeroStage backdrops={backdrops} />
        <PosterWall posters={posters} />

        <div className="relative z-10 flex min-h-[100svh] flex-col justify-end px-5 pb-16 pt-28 sm:px-10 sm:pb-20 lg:px-14">
          <div className="vitrine-rise max-w-3xl">
            <p className="text-[11px] font-semibold tracking-[0.42em] text-[#e50914] sm:text-xs">
              MINUIT
            </p>
            <h1 className="mt-4 max-w-[12ch] text-[clamp(2.85rem,9vw,6.25rem)] font-semibold leading-[0.92] tracking-tight text-white drop-shadow-[0_8px_40px_rgba(0,0,0,0.85)]">
              Le salon,&nbsp;en VF.
            </h1>
            <p className="vitrine-rise-delay mt-5 max-w-lg text-base leading-relaxed text-zinc-200/90 sm:text-lg">
              Films, séries et TV live — sur mobile et Android&nbsp;TV. Compte requis.
              Essai de 3&nbsp;jours via Telegram · un essai par appareil.
            </p>
            <div className="vitrine-rise-delay-2 mt-9 flex flex-wrap items-center gap-3">
              <a
                href="#telecharger"
                className="inline-flex items-center gap-2 rounded-md bg-white px-6 py-3.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
              >
                <IconDownload className="h-4 w-4" />
                Télécharger
              </a>
              <a
                href={TELEGRAM_ESSAI_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-[#e50914] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#f6121d]"
              >
                Demander 3&nbsp;jours
              </a>
            </div>
          </div>
        </div>
      </section>

      <section
        id="telecharger"
        className="relative z-10 scroll-mt-8 border-t border-white/5 bg-[#050505] px-5 py-20 sm:px-10 lg:px-14"
      >
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Installer Minuit</h2>
            <p className="mt-3 max-w-md text-zinc-400">
              Scanne le QR depuis le canapé, ou télécharge directement sur ton appareil.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="/minuit.apk"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-5 py-4 text-sm font-semibold text-black transition hover:bg-zinc-200"
              >
                <IconAndroid className="h-5 w-5" />
                Android téléphone
              </a>
              <a
                href="/minuit-tv.apk"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/10 px-5 py-4 text-sm font-semibold ring-1 ring-white/15 transition hover:bg-white/15"
              >
                <IconTv className="h-5 w-5" />
                Android TV
              </a>
            </div>

            <ul className="mt-8 space-y-3 text-sm text-zinc-400">
              <li className="flex gap-3">
                <IconTv className="mt-0.5 h-4 w-4 shrink-0 text-[#e50914]" />
                Interface leanback · navigation D-pad
              </li>
              <li className="flex gap-3">
                <IconLive className="mt-0.5 h-4 w-4 shrink-0 text-[#e50914]" />
                TV live française intégrée
              </li>
              <li className="flex gap-3">
                <IconAndroid className="mt-0.5 h-4 w-4 shrink-0 text-[#e50914]" />
                Même compte sur mobile et TV
              </li>
            </ul>
          </div>

          <div className="flex flex-col items-center justify-center rounded-3xl bg-white/[0.03] px-8 py-10 ring-1 ring-white/10">
            {origin ? (
              <QrCode value={origin} />
            ) : (
              <div className="h-[11.5rem] w-[11.5rem] animate-pulse rounded-xl bg-zinc-900" />
            )}
            <p className="mt-5 text-center text-sm font-medium text-white">Scanner pour ouvrir cette page</p>
            <p className="mt-1 text-center text-xs text-zinc-500">Puis choisis Android ou Android&nbsp;TV</p>
          </div>
        </div>
      </section>

      <section
        id="essai"
        className="relative z-10 scroll-mt-8 overflow-hidden border-t border-white/5 px-5 py-20 sm:px-10 lg:px-14"
      >
        {posters[0] ? (
          <div className="pointer-events-none absolute inset-0 opacity-25">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={backdrops[1]?.backdrop || backdrops[0]?.backdrop || posters[0].poster}
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-[#050505]/85" />
          </div>
        ) : null}

        <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.32em] text-[#e50914]">ESSAI</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              3&nbsp;jours via Telegram
            </h2>
            <p className="mt-4 max-w-md text-zinc-300">
              Écris au bot Minuit pour demander un compte essai. Un seul essai par appareil —
              un nouveau compte sur la même box ne relance pas l’essai.
            </p>
            <p className="mt-6 text-sm text-zinc-500">
              Déjà un compte ?{" "}
              <Link
                href="/login"
                className="text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
              >
                Connexion
              </Link>
            </p>
          </div>

          <div className="rounded-3xl bg-black/55 p-6 ring-1 ring-white/10 backdrop-blur-md sm:p-8">
            <p className="text-sm text-zinc-300">
              Ouvre Telegram, envoie ta demande, et tu reçois une réponse dans la même discussion.
            </p>
            <a
              href={TELEGRAM_ESSAI_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-6 flex w-full items-center justify-center rounded-xl bg-[#2AABEE] py-3.5 text-sm font-semibold text-white transition hover:bg-[#229ED9]"
            >
              Ouvrir @{TELEGRAM_BOT_USERNAME}
            </a>
            <p className="mt-4 text-center text-[11px] leading-relaxed text-zinc-600">
              Anonyme · pas de profils revendables · un essai par appareil
            </p>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/5 bg-[#050505] px-5 py-10 sm:px-10 lg:px-14">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mark.png" alt="" className="h-8 w-8 rounded-lg" />
            <span className="text-sm font-semibold tracking-[0.22em]">MINUIT</span>
          </div>
          <p className="text-xs text-zinc-600">Films & séries VF · Mobile & Android TV</p>
        </div>
      </footer>
    </div>
  );
}
