"use client";

import { useEffect } from "react";

type Rect = { left: number; top: number; right: number; bottom: number; cx: number; cy: number };

function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
}

function focusables(root: ParentNode = document) {
  return [...root.querySelectorAll<HTMLElement>("[data-tv-focus]")].filter(
    (el) => !el.hasAttribute("disabled") && el.offsetParent !== null && el.tabIndex !== -2,
  );
}

function score(dir: string, from: Rect, to: Rect) {
  const dx = to.cx - from.cx;
  const dy = to.cy - from.cy;
  if (dir === "ArrowLeft" && dx >= -4) return null;
  if (dir === "ArrowRight" && dx <= 4) return null;
  if (dir === "ArrowUp" && dy >= -4) return null;
  if (dir === "ArrowDown" && dy <= 4) return null;

  const primary = dir === "ArrowLeft" || dir === "ArrowRight" ? Math.abs(dx) : Math.abs(dy);
  const secondary = dir === "ArrowLeft" || dir === "ArrowRight" ? Math.abs(dy) : Math.abs(dx);
  // Prefer items roughly aligned on the movement axis.
  return primary + secondary * 2.4;
}

function moveFocus(dir: string) {
  const active = document.activeElement as HTMLElement | null;
  const nodes = focusables();
  if (!nodes.length) return;

  if (!active || !active.hasAttribute("data-tv-focus")) {
    nodes[0]?.focus();
    nodes[0]?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    return;
  }

  const from = rectOf(active);
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const node of nodes) {
    if (node === active) continue;
    const value = score(dir, from, rectOf(node));
    if (value == null || value >= bestScore) continue;
    bestScore = value;
    best = node;
  }
  if (!best) return;
  best.focus();
  best.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
}

/** Arrow-key / remote D-pad navigation for TV mode. */
export function TvSpatialNav({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;

    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        moveFocus(event.key);
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        const active = document.activeElement as HTMLElement | null;
        if (active?.hasAttribute("data-tv-focus")) {
          // Let button/link activate natively for Enter; Space on button too.
          if (event.key === " " && active.tagName !== "INPUT") {
            event.preventDefault();
            active.click();
          }
        }
      }
      if (event.key === "Backspace" || event.key === "BrowserBack" || event.key === "GoBack") {
        // Soft back: if not on browse, history back.
        if (window.location.pathname !== "/browse") {
          event.preventDefault();
          window.history.back();
        }
      }
    }

    window.addEventListener("keydown", onKey);
    // Seed focus once TV shell mounts.
    const timer = window.setTimeout(() => {
      const current = document.activeElement as HTMLElement | null;
      if (!current || current === document.body || !current.hasAttribute("data-tv-focus")) {
        focusables()[0]?.focus();
      }
    }, 120);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
    };
  }, [enabled]);

  return null;
}
