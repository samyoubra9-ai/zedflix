import { createHmac, timingSafeEqual } from "node:crypto";
import { resolveLiveStream } from "@/lib/live";

const CATALOG = "https://vavoo.to/mediahubmx-catalog.json";

type Hit = { name: string; url: string; score: number };
type Entry = { key: string; name: string; urls: Hit[] };

export type FootChannel = { key: string; name: string };
export type FootGroup = { label: string; channels: FootChannel[] };

const GROUP_ORDER = [
  "L'Équipe",
  "Chaînes",
  "beIN Sports",
  "Canal+",
  "DAZN",
  "Eurosport",
  "RMC Sport",
  "Ligue 1",
  "Sport",
];

const SEARCHES = ["beIN", "DAZN", "EUROSPORT", "RMC SPORT", "CANAL+", "L EQUIPE", "TF1", "LIGUE", "M6", "FRANCE 2"];

let cache: { at: number; entries: Entry[] } | null = null;

function secret() {
  return process.env.TELEGRAM_WEBHOOK_SECRET || process.env.ADMIN_PASSWORD || "minuit-foot-play";
}

function needle(value: string) {
  return value
    .replace(/\s*\.[a-z]\s*$/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleaned(raw: string) {
  return raw
    .replace(/\s*\.[a-z]\s*$/i, "")
    .replace(/\s*\[[^\]]*\]/g, " ")
    .replace(/\s*\((?:BACKUP|EVENT ONLY|LIVE DURING EVENTS ONLY|MATCH TIME)\)/gi, " ")
    .replace(/\b(UHD|4K|FHD|HD|SD)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function channelKey(raw: string) {
  let key = needle(cleaned(raw));
  if (key === "lequipe") key = "l equipe";
  if (key === "lequipe 21") key = "l equipe 21";
  return key;
}

function dropped(key: string) {
  if (!key) return true;
  if (key.startsWith("tf1 series")) return true;
  if (key === "m6 music" || key === "m6 international") return true;
  if (key.startsWith("france 24") || key.startsWith("orange ")) return true;
  if (/^canal (cinema|cinemas|docs|kids|action|box office|elles|family|grand ecran)\b/.test(key)) return true;
  if (key === "canal premiere" || key === "canal plus premiere") return true;
  if (key.includes("motogp") || key.includes("top 14") || key.endsWith(" news") || key.includes("sport news")) {
    return true;
  }
  return false;
}

function scoreOf(raw: string) {
  const upper = raw.toUpperCase();
  if (/\bUHD\b|\b4K\b/.test(upper)) return 0;
  let score = 4;
  if (/\bHD\b|\b720\b/.test(upper)) score = 6;
  else if (/\bFHD\b|\b1080\b/.test(upper)) score = 3;
  else if (/\bSD\b/.test(upper)) score = 2;
  if (/BACKUP/.test(upper)) score -= 2;
  return score;
}

function pretty(key: string, label: string) {
  const known: Record<string, string> = {
    "l equipe": "L'Équipe",
    "l equipe live": "L'Équipe Live",
    "l equipe live 1": "L'Équipe Live 1",
    "l equipe 21": "L'Équipe 21",
    tf1: "TF1",
    m6: "M6",
    "france 2": "France 2",
  };
  if (known[key]) return known[key];
  return label
    .replace(/\bBEIN SPORTS\b/g, "beIN Sports")
    .replace(/\bRMC SPORT\b/g, "RMC Sport")
    .replace(/\bEUROSPORT\b/g, "Eurosport")
    .replace(/\bINFO SPORT\b/g, "Info Sport")
    .replace(/\bCANAL \+/g, "Canal+")
    .replace(/\bLIGUE1\+/g, "Ligue 1+")
    .replace(/\bLIGUE \+/g, "Ligue+")
    .replace(/\bDAZN\b/g, "DAZN");
}

function family(key: string) {
  if (key.startsWith("l equipe")) return "L'Équipe";
  if (key === "tf1" || key === "m6" || key === "france 2") return "Chaînes";
  if (key.startsWith("bein")) return "beIN Sports";
  if (key.startsWith("canal") || key.includes("premier league")) return "Canal+";
  if (key.startsWith("dazn")) return "DAZN";
  if (key.startsWith("eurosport")) return "Eurosport";
  if (key.startsWith("rmc")) return "RMC Sport";
  if (key.startsWith("ligue") || key.includes("ligue")) return "Ligue 1";
  return "Sport";
}

function sign(url: string, exp: number) {
  const body = Buffer.from(JSON.stringify({ u: url, e: exp })).toString("base64url");
  const mac = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function footMediaPath(url: string) {
  const exp = Math.floor(Date.now() / 1000) + 3 * 60 * 60;
  return `/api/foot/media?t=${encodeURIComponent(sign(url, exp))}`;
}

export function readFootMediaToken(token: string) {
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      u?: string;
      e?: number;
    };
    if (!payload.u || !payload.e || payload.e < Math.floor(Date.now() / 1000)) return null;
    if (!/^https?:\/\//.test(payload.u)) return null;
    return payload.u;
  } catch {
    return null;
  }
}

async function catalog(search: string, group: string, cursor: number | null) {
  const response = await fetch(CATALOG, {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0",
      Origin: "https://vavoo.to",
      Referer: "https://vavoo.to/",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      language: "fr",
      region: "FR",
      catalogId: "iptv",
      id: "",
      adult: false,
      search,
      sort: "name",
      filter: { group },
      cursor,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) return { items: [] as Array<{ name?: string; url?: string }>, next: null as number | null };
  const data = (await response.json()) as {
    items?: Array<{ name?: string; url?: string }>;
    nextCursor?: number | null;
  };
  const next = data.nextCursor;
  return {
    items: data.items || [],
    next: next === undefined || next === null || !Number.isFinite(Number(next)) ? null : Number(next),
  };
}

async function collect(): Promise<Hit[]> {
  const jobs = SEARCHES.map((search) => catalog(search, "France", null));
  const sport: Array<{ name?: string; url?: string }> = [];
  let cursor: number | null = null;
  for (let page = 0; page < 5; page += 1) {
    const result = await catalog("", "France Sport", cursor);
    sport.push(...result.items);
    if (result.next === null) break;
    cursor = result.next;
  }
  const pages = await Promise.all(jobs);
  const items = [...sport, ...pages.flatMap((page) => page.items)];
  const hits: Hit[] = [];
  for (const item of items) {
    const raw = item.name?.trim() || "";
    const url = item.url?.trim() || "";
    const score = scoreOf(raw);
    if (!raw || !url.startsWith("http") || score <= 0) continue;
    hits.push({ name: raw, url, score });
  }
  return hits;
}

async function entries(): Promise<Entry[]> {
  if (cache && Date.now() - cache.at < 3 * 60 * 1000) return cache.entries;
  const map = new Map<string, Entry>();
  for (const hit of await collect()) {
    const key = channelKey(hit.name);
    if (dropped(key)) continue;
    const name = pretty(key, cleaned(hit.name));
    const current = map.get(key) || { key, name, urls: [] };
    if (!current.urls.some((item) => item.url === hit.url)) current.urls.push(hit);
    map.set(key, current);
  }
  const list = [...map.values()];
  for (const entry of list) {
    entry.urls.sort((a, b) => b.score - a.score);
    entry.urls = entry.urls.slice(0, 3);
  }
  list.sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }));
  cache = { at: Date.now(), entries: list };
  return list;
}

export async function listFootGroups(): Promise<FootGroup[]> {
  const buckets = new Map<string, FootChannel[]>();
  for (const entry of await entries()) {
    const label = family(entry.key);
    const list = buckets.get(label) || [];
    list.push({ key: entry.key, name: entry.name });
    buckets.set(label, list);
  }
  return GROUP_ORDER.filter((label) => buckets.has(label)).map((label) => ({
    label,
    channels: buckets.get(label) || [],
  }));
}

export async function openFootChannel(key: string) {
  const wanted = needle(key);
  const match = (await entries()).find((entry) => entry.key === wanted);
  if (!match) throw new Error("Chaîne introuvable");
  let last = "La chaîne n'a pas démarré";
  for (const hit of match.urls) {
    try {
      const video = await resolveLiveStream(hit.url);
      return {
        src: footMediaPath(video.stream),
        title: match.name,
        poster: "",
        live: true,
      };
    } catch (error) {
      last = error instanceof Error ? error.message : last;
    }
  }
  throw new Error(last);
}
