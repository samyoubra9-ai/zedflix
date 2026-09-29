"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type Rect = { left: number; top: number; right: number; bottom: number; cx: number; cy: number };

const ROW_TOL = 48;

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
  if (el.tabIndex < -1) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (Number(style.opacity) === 0) return false;
  let node: HTMLElement | null = el.parentElement;
  while (node && node !== document.body) {
    const cs = window.getComputedStyle(node);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
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

  if (dir === "ArrowLeft" && dx >= 8) return null;
  if (dir === "ArrowRight" && dx <= -8) return null;
  if (dir === "ArrowUp" && dy >= 8) return null;
  if (dir === "ArrowDown" && dy <= -8) return null;

  const primary = dir === "ArrowLeft" || dir === "ArrowRight" ? Math.abs(dx) : Math.abs(dy);
  const secondary = dir === "ArrowLeft" || dir === "ArrowRight" ? Math.abs(dy) : Math.abs(dx);
  const aligned =
    dir === "ArrowLeft" || dir === "ArrowRight"
      ? overlapY > 4 || secondary < 100
      : overlapX > 4 || secondary < 100;

  return primary + secondary * (aligned ? 1.05 : 2.2) + (aligned ? 0 : 120);
}

function contentFocusables(all: HTMLElement[]) {
  return all.filter((el) => {
    const zone = zoneOf(el);
    return zone === "content" || zone === "player";
  });
}

function filterFocusables(all: HTMLElement[]) {
  return all.filter((el) => zoneOf(el) === "filters");
}

function sameRow(nodes: HTMLElement[], focused: HTMLElement) {
  const from = rectOf(focused);
  return nodes
    .filter((el) => Math.abs(rectOf(el).cy - from.cy) <= ROW_TOL)
    .sort((a, b) => rectOf(a).left - rectOf(b).left);
}

function rowsOf(nodes: HTMLElement[]) {
  const sorted = [...nodes].sort((a, b) => {
    const da = rectOf(a);
    const db = rectOf(b);
    if (Math.abs(da.cy - db.cy) > ROW_TOL) return da.cy - db.cy;
    return da.left - db.left;
  });
  const rows: HTMLElement[][] = [];
  for (const el of sorted) {
    const cy = rectOf(el).cy;
    const last = rows[rows.length - 1];
    if (last && Math.abs(rectOf(last[0]).cy - cy) <= ROW_TOL) last.push(el);
    else rows.push([el]);
  }
  for (const row of rows) row.sort((a, b) => rectOf(a).left - rectOf(b).left);
  return rows;
}

/** Deterministic grid step: same row left/right, then wrap to next/prev row. */
function stepGrid(focused: HTMLElement, dir: string, nodes: HTMLElement[]): HTMLElement | null {
  if (!nodes.length) return null;
  const rows = rowsOf(nodes);
  let rowIndex = -1;
  let colIndex = -1;
  for (let r = 0; r < rows.length; r += 1) {
    const c = rows[r].indexOf(focused);
    if (c >= 0) {
      rowIndex = r;
      colIndex = c;
      break;
    }
  }
  if (rowIndex < 0) return null;

  if (dir === "ArrowRight") {
    const row = rows[rowIndex];
    if (colIndex < row.length - 1) return row[colIndex + 1];
    const next = rows[rowIndex + 1];
    return next?.[0] || null;
  }
  if (dir === "ArrowLeft") {
    const row = rows[rowIndex];
    if (colIndex > 0) return row[colIndex - 1];
    const prev = rows[rowIndex - 1];
    return prev?.[prev.length - 1] || null;
  }
  if (dir === "ArrowDown") {
    const next = rows[rowIndex + 1];
    if (!next) return null;
    return next[Math.min(colIndex, next.length - 1)] || null;
  }
  if (dir === "ArrowUp") {
    const prev = rows[rowIndex - 1];
    if (!prev) return null;
    return prev[Math.min(colIndex, prev.length - 1)] || null;
  }
  return null;
}

function pickGeometric(focused: HTMLElement, dir: string, nodes: HTMLElement[]) {
  const from = rectOf(focused);
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const node of nodes) {
    if (node === focused) continue;
    const value = score(dir, from, rectOf(node));
    if (value == null || value >= bestScore) continue;
    bestScore = value;
    best = node;
  }
  return best;
}

function candidatesFor(active: HTMLElement | null, dir: string) {
  const all = focusables();
  if (!all.length) return all;
  if (!active) return all;

  const zone = zoneOf(active);
  const inZone = (el: HTMLElement) => zoneOf(el) === zone;

  if (zone === "rail") {
    if (dir === "ArrowRight") {
      const content = contentFocusables(all);
      if (content.length) return content;
      const filters = filterFocusables(all);
      return filters.length ? filters : all;
    }
    return all.filter((el) => zoneOf(el) === "rail");
  }

  if (zone === "filters") {
    const local = all.filter(inZone);
    if (dir === "ArrowDown") {
      const content = contentFocusables(all);
      return content.length ? content : local;
    }
    if (dir === "ArrowLeft") {
      const row = sameRow(local, active);
      if (row.indexOf(active) <= 0) {
        const rail = all.filter((el) => zoneOf(el) === "rail");
        return rail.length ? rail : local;
      }
    }
    return local.length ? local : all;
  }

  if (zone === "content" || zone === "player") {
    const local = all.filter(inZone);
    if (dir === "ArrowUp") {
      const filters = filterFocusables(all);
      const rows = rowsOf(local);
      if (filters.length && rows[0]?.includes(active)) return filters;
    }
    if (dir === "ArrowLeft") {
      const row = sameRow(local, active);
      if (row.indexOf(active) <= 0) {
        const rail = all.filter((el) => zoneOf(el) === "rail");
        return rail.length ? rail : local;
      }
    }
    return local.length ? local : all;
  }

  return all;
}

function focusNode(node: HTMLElement | null | undefined) {
  if (!node) return;
  node.focus({ preventScroll: true });
  node.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
}

function moveFocus(dir: string) {
  const active = document.activeElement as HTMLElement | null;
  const focused = active?.hasAttribute("data-tv-focus") ? active : null;
  const nodes = candidatesFor(focused, dir);
  if (!nodes.length) return;

  if (!focused) {
    focusNode(contentFocusables(nodes)[0] || nodes[0]);
    return;
  }

  const zone = zoneOf(focused);

  if (zone === "rail" && dir === "ArrowRight") {
    const content = contentFocusables(nodes);
    focusNode(
      content.find((el) => el.hasAttribute("data-tv-autofocus")) ||
        content[0] ||
        filterFocusables(nodes)[0] ||
        nodes[0],
    );
    return;
  }

  if (zone === "filters" && dir === "ArrowDown") {
    const content = contentFocusables(focusables());
    focusNode(content.find((el) => el.hasAttribute("data-tv-autofocus")) || content[0]);
    return;
  }

  if (zone === "content" && dir === "ArrowUp") {
    const local = nodes.filter((el) => zoneOf(el) === "content");
    const rows = rowsOf(local);
    if (rows[0]?.includes(focused)) {
      const filters = filterFocusables(focusables());
      if (filters.length) {
        focusNode(filters[filters.length - 1]);
        return;
      }
    }
  }

  if ((zone === "content" || zone === "filters") && dir === "ArrowLeft") {
    const row = sameRow(nodes, focused);
    if (row.indexOf(focused) <= 0) {
      const rail = focusables().filter((el) => zoneOf(el) === "rail");
      const currentPath = window.location.pathname;
      const preferred =
        rail.find((el) => {
          const href = el.getAttribute("href");
          return href && (currentPath === href || currentPath.startsWith(`${href}/`));
        }) || rail[0];
      if (preferred) {
        focusNode(preferred);
        return;
      }
    }
  }

  if (zone === "content" || zone === "player" || zone === "filters" || !zone) {
    const gridNext = stepGrid(focused, dir, nodes);
    if (gridNext) {
      focusNode(gridNext);
      return;
    }
  }

  const geometric = pickGeometric(focused, dir, nodes);
  if (geometric) {
    focusNode(geometric);
    return;
  }

  if (dir === "ArrowRight" || dir === "ArrowLeft") {
    const wrapDir = dir === "ArrowRight" ? "ArrowDown" : "ArrowUp";
    const wrapped = stepGrid(focused, wrapDir, nodes) || pickGeometric(focused, wrapDir, nodes);
    if (wrapped) focusNode(wrapped);
  }
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

function focusFirstContent() {
  const all = focusables();
  const content = contentFocusables(all);
  const preferred =
    content.find((el) => el.hasAttribute("data-tv-autofocus")) ||
    content[0] ||
    document.querySelector<HTMLElement>("[data-tv-autofocus]") ||
    all[0];
  focusNode(preferred);
}

/** Arrow-key / remote D-pad navigation for TV mode — zone-aware, grid-first. */
export function TvSpatialNav({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!enabled) return;

    let lastKey = "";
    let lastAt = 0;

    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (target?.closest("[data-dialog]")) return;

      const now = performance.now();
      const repeating = event.repeat || (event.key === lastKey && now - lastAt < 70);

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
        if (event.key === "Enter" && (target?.tagName === "BUTTON" || target?.tagName === "A")) {
          return;
        }
        activateFocused(event);
        return;
      }

      if (
        event.key === "Backspace" ||
        event.key === "BrowserBack" ||
        event.key === "GoBack" ||
        event.key === "Escape"
      ) {
        const path = window.location.pathname;
        if (path.startsWith("/watch")) return;
        if (path === "/browse") return;
        event.preventDefault();
        window.history.back();
      }
    }

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enabled]);

  // After route change (or late catalog load), land focus in the content grid.
  useEffect(() => {
    if (!enabled) return;
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      const content = contentFocusables(focusables());
      if (content.length) {
        const active = document.activeElement as HTMLElement | null;
        const inContent = active?.hasAttribute("data-tv-focus") && zoneOf(active) === "content";
        if (!inContent) focusFirstContent();
        window.clearInterval(timer);
        return;
      }
      if (tries >= 40) window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, [enabled, pathname]);

  return null;
}
