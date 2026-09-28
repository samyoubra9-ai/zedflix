export type WatchProgress = {
  kind: "movie" | "show";
  id: string;
  episode?: number;
  title: string;
  poster?: string;
  seconds: number;
  duration: number;
  updatedAt: number;
};

const STORAGE_KEY = "minuit.watch.progress.v2";

function readAll(): WatchProgress[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WatchProgress[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items: WatchProgress[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 40)));
}

function same(a: WatchProgress, b: Pick<WatchProgress, "kind" | "id" | "episode">) {
  return a.kind === b.kind && a.id === b.id && (a.episode || 0) === (b.episode || 0);
}

export function progressKey(kind: string, id: string, episode?: number) {
  return `${kind}:${id}:${episode || 0}`;
}

export function getProgress(
  kind: "movie" | "show",
  id: string,
  episode?: number,
): WatchProgress | null {
  return readAll().find((item) => same(item, { kind, id, episode })) || null;
}

export function saveProgress(entry: WatchProgress) {
  const items = readAll().filter((item) => !same(item, entry));
  const ratio = entry.duration > 0 ? entry.seconds / entry.duration : 0;
  if (entry.seconds < 8 || ratio > 0.95) {
    writeAll(items);
    return;
  }
  writeAll([{ ...entry, updatedAt: Date.now() }, ...items]);
}

export function listContinueWatching(): WatchProgress[] {
  return readAll()
    .filter((item) => item.duration > 0 && item.seconds / item.duration < 0.95)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 16);
}

export function clearProgress(kind: "movie" | "show", id: string, episode?: number) {
  writeAll(readAll().filter((item) => !same(item, { kind, id, episode })));
}

export function watchHref(item: WatchProgress) {
  if (item.kind === "show" && item.episode) {
    return `/watch/${encodeURIComponent(item.id)}/${item.episode}`;
  }
  return `/watch/${encodeURIComponent(item.id)}`;
}
