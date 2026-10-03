"use client";

import { useState } from "react";
import { armLiveSound, LiveStage } from "@/components/live-stage";
import type { FootGroup } from "@/lib/foot-play";

export function FootPlayer({ groups }: { groups: FootGroup[] }) {
  const [current, setCurrent] = useState<{ key: string; name: string } | null>(null);

  function choose(key: string, name: string) {
    armLiveSound();
    setCurrent({ key, name });
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.label}>
          <h2 className="text-xs font-medium tracking-wide text-zinc-500 uppercase">{group.label}</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {group.channels.map((channel) => (
              <button
                key={channel.key}
                type="button"
                onClick={() => choose(channel.key, channel.name)}
                className={`rounded-full px-2.5 py-1 text-xs ${
                  current?.key === channel.key
                    ? "bg-[#e50914] text-white"
                    : "bg-white/10 text-zinc-100 hover:bg-white/20"
                }`}
              >
                {channel.name}
              </button>
            ))}
          </div>
        </section>
      ))}
      {current ? (
        <LiveStage
          id={current.key}
          back="/foot"
          playPath={`/api/foot/play?channel=${encodeURIComponent(current.key)}`}
          onClose={() => setCurrent(null)}
        />
      ) : null}
    </div>
  );
}
