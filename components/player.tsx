"use client";

import Hls from "hls.js";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Spinner } from "./loading";

export function Player({
  id,
  episode,
  back,
}: {
  id: string;
  episode?: number;
  back: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setLoading(true);
    setStatus("");
    let hls: Hls | null = null;
    let stop = false;
    const path = episode
      ? `/api/watch/play?id=${encodeURIComponent(id)}&episode=${episode}`
      : `/api/watch/play?id=${encodeURIComponent(id)}`;

    fetch(path)
      .then(async (response) => {
        const data = (await response.json()) as { src?: string; error?: string };
        if (stop) return;
        if (!response.ok || !data.src) {
          setLoading(false);
          setStatus(data.error || "Lecture impossible");
          return;
        }
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = data.src;
        } else if (Hls.isSupported()) {
          hls = new Hls();
          hls.loadSource(data.src);
          hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_event, info) => {
            if (info.fatal) setStatus("Le lecteur n’a pas pu lire la vidéo.");
          });
        } else {
          setLoading(false);
          setStatus("Ce navigateur ne lit pas ce format.");
          return;
        }
        video.onplaying = () => setLoading(false);
        await video.play().catch(() => setLoading(false));
      })
      .catch(() => {
        if (!stop) {
          setLoading(false);
          setStatus("Lecture impossible");
        }
      });

    return () => {
      stop = true;
      hls?.destroy();
    };
  }, [id, episode]);

  return (
    <main className="flex h-screen flex-col bg-black text-white">
      <header className="flex items-center gap-4 px-4 py-3">
        <Link href={back} className="text-sm text-zinc-300">
          Retour
        </Link>
        <span className="text-sm font-semibold tracking-tight text-red-600">MINUIT</span>
        {status ? <span className="text-sm text-zinc-400">{status}</span> : null}
      </header>
      <div className="relative min-h-0 flex-1">
        {loading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <Spinner className="h-12 w-12" />
          </div>
        ) : null}
        <video ref={videoRef} controls autoPlay playsInline className="h-full w-full bg-black" />
      </div>
    </main>
  );
}
