"use client";

import { useEffect, useState } from "react";

const LOCK_MS = 30_000;
const MAX_TRIES = 5;

function lockKey(profileId: string) {
  return `minuit_pin_lock:${profileId}`;
}

export function readPinLock(profileId: string) {
  try {
    const raw = localStorage.getItem(lockKey(profileId));
    if (!raw) return { tries: 0, until: 0 };
    const data = JSON.parse(raw) as { tries?: number; until?: number };
    return { tries: Number(data.tries) || 0, until: Number(data.until) || 0 };
  } catch {
    return { tries: 0, until: 0 };
  }
}

export function notePinFail(profileId: string) {
  const current = readPinLock(profileId);
  const tries = current.tries + 1;
  const until = tries >= MAX_TRIES ? Date.now() + LOCK_MS : 0;
  localStorage.setItem(lockKey(profileId), JSON.stringify({ tries: tries >= MAX_TRIES ? 0 : tries, until }));
  return { tries, until, locked: until > Date.now() };
}

export function clearPinLock(profileId: string) {
  localStorage.removeItem(lockKey(profileId));
}

export function PinPad({
  name,
  value,
  onChange,
  onSubmit,
  onCancel,
  status,
  busy,
  trust,
  onTrustChange,
  showTrust = true,
}: {
  name: string;
  value: string;
  onChange: (pin: string) => void;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
  status?: string;
  busy?: boolean;
  trust?: boolean;
  onTrustChange?: (value: boolean) => void;
  showTrust?: boolean;
}) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

  function press(key: string) {
    if (busy) return;
    if (key === "⌫") {
      onChange(value.slice(0, -1));
      return;
    }
    if (!key || value.length >= 4) return;
    const next = `${value}${key}`.slice(0, 4);
    onChange(next);
  }

  useEffect(() => {
    if (value.length !== 4 || busy) return;
    const timer = window.setTimeout(() => onSubmit(value), 40);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, busy]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 sm:items-center sm:px-4">
      <div className="w-full max-w-sm rounded-t-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl sm:rounded-2xl sm:p-6">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
        <p className="text-sm text-zinc-400">Code pour</p>
        <h2 className="mt-1 text-2xl font-semibold">{name}</h2>

        <div className="mt-6 flex justify-center gap-3">
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              className={`h-3.5 w-3.5 rounded-full ${
                value.length > index ? "bg-white" : "bg-white/20"
              }`}
            />
          ))}
        </div>

        {status ? <p className="mt-4 text-center text-sm text-red-400">{status}</p> : null}

        {showTrust ? (
          <label className="mt-5 flex items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={Boolean(trust)}
              onChange={(event) => onTrustChange?.(event.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-zinc-900"
            />
            Se souvenir sur cet appareil
          </label>
        ) : null}

        <div className="mt-5 grid grid-cols-3 gap-2">
          {keys.map((key, index) =>
            key ? (
              <button
                key={`${key}-${index}`}
                type="button"
                disabled={busy}
                onClick={() => press(key)}
                className="h-14 rounded-xl bg-white/5 text-xl font-semibold text-white transition active:scale-95 hover:bg-white/10 disabled:opacity-40"
              >
                {key}
              </button>
            ) : (
              <span key={`pad-${index}`} />
            ),
          )}
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="mt-4 h-11 w-full rounded-lg bg-white/10 text-sm font-medium"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

export function usePinLockCountdown(profileId: string | null) {
  const [until, setUntil] = useState(0);
  useEffect(() => {
    if (!profileId) {
      setUntil(0);
      return;
    }
    const tick = () => setUntil(readPinLock(profileId).until);
    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [profileId]);
  const remaining = Math.max(0, until - Date.now());
  return { locked: remaining > 0, seconds: Math.ceil(remaining / 1000) };
}
