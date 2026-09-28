import type { Poster } from "@/components/posters";

const LIST_KEY = "minuit.my.list.v1";
const LIKES_KEY = "minuit.likes.v1";

function readList(): Poster[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Poster[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList(items: Poster[]) {
  localStorage.setItem(LIST_KEY, JSON.stringify(items.slice(0, 120)));
  window.dispatchEvent(new Event("minuit-list"));
}

function keyOf(item: Pick<Poster, "kind" | "id">) {
  return `${item.kind}:${item.id}`;
}

export function listMyList(): Poster[] {
  return readList();
}

export function isInMyList(item: Pick<Poster, "kind" | "id">) {
  return readList().some((entry) => keyOf(entry) === keyOf(item));
}

export function toggleMyList(item: Poster) {
  const items = readList();
  const exists = items.some((entry) => keyOf(entry) === keyOf(item));
  const next = exists
    ? items.filter((entry) => keyOf(entry) !== keyOf(item))
    : [{ id: item.id, title: item.title, poster: item.poster, kind: item.kind }, ...items];
  writeList(next);
  return !exists;
}

function readLikes(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LIKES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLikes(items: string[]) {
  localStorage.setItem(LIKES_KEY, JSON.stringify(items.slice(0, 200)));
  window.dispatchEvent(new Event("minuit-likes"));
}

export function isLiked(item: Pick<Poster, "kind" | "id">) {
  return readLikes().includes(keyOf(item));
}

export function toggleLike(item: Pick<Poster, "kind" | "id">) {
  const key = keyOf(item);
  const items = readLikes();
  const exists = items.includes(key);
  writeLikes(exists ? items.filter((entry) => entry !== key) : [key, ...items]);
  return !exists;
}
