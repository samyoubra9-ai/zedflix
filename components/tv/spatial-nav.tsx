"use client";

import { useEffect } from "react";

type Rect = { left: number; top: number; right: number; bottom: number; cx: number; cy: number };

function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return {
    left: r.left,
    top: r.top,
    right: r.right,
    bottom: r.bottom,
    cx: r.left + r.width / 2,
    cy: r.top + r.height / 2,
  };
}

function isVisible(el: HTMLElement) {
  if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") return false;
  if (el.tabIndex === -2) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
    return false;
  }
  let node: HTMLElement | null = el;
  while (node && node !== document.body) {
    const cs = window.getComputedStyle(node);
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
    if (cs.pointerEvents === "none" && node !== el) return false;
    node = node.parentElement;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 2 && rect.height > 2;
}

function focusables(root: ParentNode = document) {
  return [...root.querySelectorAll<HTMLElement>("[data-tv-focus]")].filter(isVisible);
}

function zoneOf(el: Element | null) {
  return el?.closest<HTMLElement>("[data-tv-zone]")?.dataset.tvZone || "";
}

function score(dir: string, from: Rect, to: Rect) {
  const dx = to.cx - from.cx;
  const dy = to.cy - from.cy;
  const overlapX = Math.min(from.right, to.right) - Math.max(from.left, to.left);
  const overlapY = Math.min(from.bottom, to.bottom) - Math.max(from.top, to.top);

  if (dir === "ArrowLeft" && dx >= -2) return null;
  if (dir === "ArrowRight" && dx <= 2) return null;
  if (dir === "ArrowUp" && dy >= -2) return null;
  if (dir === "ArrowDown" && dy <= 2) return null;

  const primary = dir === "ArrowLeft" || dir === "ArrowRight" ? Math.abs(dx) : Math.abs(dy);
  const secondary = dir === "ArrowLeft" || dir === "ArrowRight" ? Math.abs(dy) : Math.abs(dx);
  const aligned =
    dir === "ArrowLeft" || dir === "ArrowRight"
      ? overlapY > 8 || secondary < 48
      : overlapX > 8 || secondary < 48;

  // Strongly prefer items on the same row/column so grids feel stable on a remote.
  return primary + secondary * (aligned ? 1.15 : 3.4) + (aligned ? 0 : 180);
}

function candidatesFor(active: HTMLElement | null, dir: string) {
  const all = focusables();
  if (!all.length) return all;
  if (!active) return all;

  const zone = zoneOf(active);
  const inZone = (el: HTMLElement) => zoneOf(el) === zone;

  if (zone === "rail") {
    if (dir === "ArrowRight") {
      const content = all.filter((el) => zoneOf(el) === "content" || zoneOf(el) === "player");
      return content.length ? content : all;
    }
    return all.filter((el) => zoneOf(el) === "rail");
  }

  if (zone === "content" || zone === "player") {
    const local = all.filter(inZone);
    if (dir === "ArrowLeft") {
      const from = rectOf(active);
      const leftLocal = local.filter((el) => {
        if (el === active) return false;
        return score(dir, from, rectOf(el)) != null;
      });
      if (leftLocal.length) return local;
      // Exit to the rail only when nothing is left in the content zone.
      const rail = all.filter((el) => zoneOf(el) === "rail");
      return rail.length ? rail : local;
    }
    return local.length ? local : all;
  }

  return all;
}

function moveFocus(dir: string) {
  const active = document.activeElement as HTMLElement | null;
  const nodes = candidatesFor(active?.hasAttribute("data-tv-focus") ? active : null, dir);
  if (!nodes.length) return;

  if (!active || !active.hasAttribute("data-tv-focus")) {
    const first = nodes[0];
    first?.focus({ preventScroll: true });
    first?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    return;
  }

  // Jump rail → first content item on Right.
  if (zoneOf(active) === "rail" && dir === "ArrowRight") {
    const target = nodes[0];
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
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
  best.focus({ preventScroll: true });
  best.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
}

function activateFocused(event: KeyboardEvent) {
  const active = document.activeElement as HTMLElement | null;
  if (!active?.hasAttribute("data-tv-focus")) return false;
  if (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable) {
    return false;
  }
  event.preventDefault();
  event.stopPropagation();
  active.click();
  return true;
}

/** Arrow-key / remote D-pad navigation for TV mode — zone-aware, repeat-safe. */
export function TvSpatialNav({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;

    let lastKey = "";
    let lastAt = 0;

    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      // Don't fight dialogs / overlays that manage their own keys.
      if (target?.closest("[data-dialog]")) return;

      const now = performance.now();
      const repeating =
        event.repeat || (event.key === lastKey && now - lastAt < 70);

      if (
        event.key === "ArrowUp" ||
        event.key === "ArrowDown" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight"
      ) {
        event.preventDefault();
        if (repeating && now - lastAt < 90) return;
        lastKey = event.key;
        lastAt = now;
        moveFocus(event.key);
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        if (repeating) {
          event.preventDefault();
          return;
        }
        lastKey = event.key;
        lastAt = now;
        if (event.key === " " || event.key === "Enter") {
          // Enter on <a>/<button> is native; Space needs a click. Avoid double-fires.
          if (event.key === "Enter" && (target?.tagName === "BUTTON" || target?.tagName === "A")) {
            return;
          }
          activateFocused(event);
        }
        return;
      }

      if (
        event.key === "Backspace" ||
        event.key === "BrowserBack" ||
        event.key === "GoBack" ||
        event.key === "Escape"
      ) {
        const path = window.location.pathname;
        if (path.startsWith("/watch")) return; // player handles back
        if (path === "/browse") return;
        event.preventDefault();
        window.history.back();
      }
    }

    window.addEventListener("keydown", onKey, true);
    const timer = window.setTimeout(() => {
      const current = document.activeElement as HTMLElement | null;
      if (!current || current === document.body || !current.hasAttribute("data-tv-focus")) {
        const preferred =
          document.querySelector<HTMLElement>("[data-tv-autofocus]") || focusables()[0];
        preferred?.focus({ preventScroll: true });
      }
    }, 160);

    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.clearTimeout(timer);
    };
  }, [enabled]);

  return null;
}
