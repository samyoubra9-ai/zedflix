export type WatchProgress = {
  type: "movie" | "tv";
  id: number;
  title: string;
  poster: string | null;
  backdrop: string | null;
  videoKey: string;
  seconds: number;
  duration: number;
  updatedAt: number;
};

const STORAGE_KEY = "minuit.watch.progress.v1";

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

export function progressKey(type: string, id: number | string, videoKey?: string) {
  return `${type}:${id}:${videoKey || "default"}`;
}

export function getProgress(
  type: "movie" | "tv",
  id: number,
  videoKey: string,
): WatchProgress | null {
  return (
    readAll().find(
      (item) => item.type === type && item.id === id && item.videoKey === videoKey,
    ) || null
  );
}

export function saveProgress(entry: WatchProgress) {
  const items = readAll().filter(
    (item) =>
      !(item.type === entry.type && item.id === entry.id && item.videoKey === entry.videoKey),
  );
  // Skip tiny watches / almost finished
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

export function clearProgress(type: "movie" | "tv", id: number, videoKey: string) {
  writeAll(
    readAll().filter(
      (item) => !(item.type === type && item.id === id && item.videoKey === videoKey),
    ),
  );
}
