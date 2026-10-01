"use client";

import { Player } from "@/components/player";

const SILENT =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

/** Call inside the channel click so the browser allows sound without a prompt. */
export function armLiveSound() {
  const existing = document.getElementById("minuit-live-arm");
  const audio =
    existing instanceof HTMLAudioElement ? existing : document.createElement("audio");
  audio.id = "minuit-live-arm";
  audio.setAttribute("playsinline", "true");
  if (!audio.parentElement) document.body.appendChild(audio);
  audio.muted = false;
  audio.volume = 1;
  audio.src = SILENT;
  void audio.play().catch(() => undefined);
}

export function LiveStage({ id, onClose }: { id: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] bg-black">
      <Player id={id} live back="/tv" onClose={onClose} />
    </div>
  );
}
