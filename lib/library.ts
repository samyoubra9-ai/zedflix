import { AccountError, admin, userFromToken } from "./accounts";

const BUCKET = "minuit-library";
const FAVORITE_CAP = 120;
const RESUME_CAP = 40;
const TOMBSTONE_CAP = 40;

type LibraryItem = {
  kind: "movie" | "show" | "episode";
  id: string;
  title: string;
  poster: string;
  banner: string;
  at: number;
  on: boolean;
  position: number;
  duration: number;
  showId: string;
  showTitle: string;
  showPoster: string;
  showBanner: string;
  seasonId: string;
  seasonNumber: number;
  number: number;
  done: boolean;
};

type LibraryDoc = {
  rev: number;
  favorites: LibraryItem[];
  resume: LibraryItem[];
};

const emptyDoc = (): LibraryDoc => ({ rev: 0, favorites: [], resume: [] });

function text(value: unknown, max: number) {
  return String(value || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, max);
}

function itemOf(value: unknown): LibraryItem | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const kind = raw.kind === "show" || raw.kind === "episode" ? raw.kind : raw.kind === "movie" ? "movie" : "";
  const id = text(raw.id, 180);
  const at = Number(raw.at);
  if (!kind || !id || !Number.isFinite(at) || at < 0) return null;
  return {
    kind,
    id,
    title: text(raw.title, 120),
    poster: text(raw.poster, 500),
    banner: text(raw.banner, 500),
    at,
    on: raw.on !== false,
    position: Math.max(0, Number(raw.position) || 0),
    duration: Math.max(0, Number(raw.duration) || 0),
    showId: text(raw.showId, 180),
    showTitle: text(raw.showTitle, 120),
    showPoster: text(raw.showPoster, 500),
    showBanner: text(raw.showBanner, 500),
    seasonId: text(raw.seasonId, 180),
    seasonNumber: Math.max(0, Math.round(Number(raw.seasonNumber) || 0)),
    number: Math.max(0, Math.round(Number(raw.number) || 0)),
    done: raw.done === true,
  };
}

function listOf(value: unknown, cap: number) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = itemOf(item);
    return parsed ? [parsed] : [];
  }).slice(0, cap);
}

function providerSlug(provider: string) {
  const slug = provider.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  if (!slug) throw new AccountError("Catalogue inconnu", 400);
  return slug;
}

let bucketReady: Promise<void> | null = null;

function ensureBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const { error } = await admin().storage.createBucket(BUCKET, { public: false, fileSizeLimit: 524288 });
      if (error && !/exist/i.test(error.message)) {
        bucketReady = null;
        throw new AccountError(error.message, 500);
      }
    })();
  }
  return bucketReady;
}

async function readDoc(path: string): Promise<LibraryDoc> {
  const { data, error } = await admin().storage.from(BUCKET).download(path);
  if (error || !data) return emptyDoc();
  const parsed = await data.text().then((text) => JSON.parse(text) as Record<string, unknown>).catch(() => null);
  if (!parsed) return emptyDoc();
  return {
    rev: Number(parsed.rev) || 0,
    favorites: listOf(parsed.favorites, FAVORITE_CAP + TOMBSTONE_CAP),
    resume: listOf(parsed.resume, RESUME_CAP + TOMBSTONE_CAP),
  };
}

async function writeDoc(path: string, doc: LibraryDoc) {
  const { error } = await admin()
    .storage.from(BUCKET)
    .upload(path, JSON.stringify(doc), { upsert: true, contentType: "application/json" });
  if (error) throw new AccountError(error.message, 500);
}

function mergeItems(current: LibraryItem[], incoming: LibraryItem[], cap: number) {
  const map = new Map<string, LibraryItem>();
  for (const item of current) map.set(`${item.kind}:${item.id}`, item);
  for (const item of incoming) {
    const key = `${item.kind}:${item.id}`;
    const previous = map.get(key);
    if (!previous || item.at >= previous.at) map.set(key, item);
  }
  const sorted = [...map.values()].sort((a, b) => b.at - a.at);
  return [...sorted.filter((item) => item.on).slice(0, cap), ...sorted.filter((item) => !item.on).slice(0, TOMBSTONE_CAP)];
}

export async function syncLibrary(
  accessToken: string,
  deviceId: string,
  profileId: string,
  provider: string,
  favorites: unknown,
  resume: unknown,
) {
  if (!/^[a-zA-Z0-9]{4,40}$/.test(profileId)) throw new AccountError("Profil introuvable", 400);
  const user = await userFromToken(accessToken, deviceId);
  await ensureBucket();
  const path = `${user.id}/${profileId}/${providerSlug(provider)}.json`;
  const incomingFavorites = listOf(favorites, 240);
  const incomingResume = listOf(resume, 80);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await readDoc(path);
    const next: LibraryDoc = {
      rev: current.rev + 1,
      favorites: mergeItems(current.favorites, incomingFavorites, FAVORITE_CAP),
      resume: mergeItems(current.resume, incomingResume, RESUME_CAP),
    };
    await writeDoc(path, next);
    const saved = await readDoc(path);
    if (saved.rev === next.rev) return saved;
  }
  throw new AccountError("Réessaie dans un instant", 409);
}

export async function removeLibraryFolder(userId: string, profileId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !/^[a-zA-Z0-9]{4,40}$/.test(profileId)) return;
  await ensureBucket().catch(() => undefined);
  const folder = `${userId}/${profileId}`;
  const { data } = await admin().storage.from(BUCKET).list(folder);
  if (!data?.length) return;
  await admin()
    .storage.from(BUCKET)
    .remove(data.map((file) => `${folder}/${file.name}`));
}

export async function removeLibrary(accessToken: string, deviceId: string, profileId: string) {
  const user = await userFromToken(accessToken, deviceId);
  await removeLibraryFolder(user.id, profileId);
}
