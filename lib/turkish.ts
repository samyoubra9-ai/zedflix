import type { WatchCard, WatchEpisode, WatchHome, WatchPlayResult, WatchTitle } from "./watch";

const ORIGIN = "https://3sk.quest";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

type Card = {
  slug: string;
  title: string;
  poster: string;
  kind: "movie" | "show";
};

type ListedEpisode = WatchEpisode & { slug: string };

let listed: { at: number; films: Card[]; series: Card[] } | null = null;

function pack(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function unpack(value: string) {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function movieId(slug: string) {
  return `tr-m-${pack(slug)}`;
}

function showId(slug: string) {
  return `tr-s-${pack(slug)}`;
}

function showSeasonId(slug: string, seasonKey: string) {
  return `tr-s-${pack(`${slug}\n${seasonKey}`)}`;
}

function parseId(id: string) {
  const raw = id.startsWith("tr-m-") || id.startsWith("tr-s-") ? id.slice(5) : "";
  if (!raw) throw new Error("Titre introuvable");
  let value = "";
  try {
    value = unpack(raw);
  } catch {
    throw new Error("Titre introuvable");
  }
  const [slug, seasonKey = ""] = value.split("\n");
  if (
    !slug ||
    slug.includes("/") ||
    slug.includes("\\") ||
    slug.includes("..") ||
    (seasonKey && !/^\d+$/.test(seasonKey))
  ) {
    throw new Error("Titre introuvable");
  }
  return { slug, seasonKey };
}

function decode(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanTitle(raw: string) {
  return decode(raw)
    .replace(/<[^>]+>/g, " ")
    .replace(/قصة\s*عشق/g, "")
    .replace(/3sk\.quest/gi, "")
    .replace(/^فيلم\s+/u, "")
    .replace(/^مسلسل\s+/u, "")
    .replace(/\s+مترجم(?:ة)?\s*$/u, "")
    .replace(/\s+الحلقة\s+\d+.*$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function absUrl(value: string) {
  if (!value) return "";
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("http")) return value;
  if (value.startsWith("/")) return `${ORIGIN}${value}`;
  return value;
}

function slugFromHref(href: string, folder: "watch" | "series") {
  try {
    const url = new URL(href, ORIGIN);
    const parts = url.pathname.split("/").filter(Boolean);
    const index = parts.indexOf(folder);
    const slug = parts[index + 1] || "";
    if (!slug || slug === "see") return "";
    return decodeURIComponent(slug);
  } catch {
    return "";
  }
}

async function fetchText(url: string, referer = `${ORIGIN}/`) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: referer,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ar,fr;q=0.8,en;q=0.6",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("Catalogue indisponible");
  return response.text();
}

async function fetchOptional(url: string, referer: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Referer: referer,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ar,fr;q=0.8,en;q=0.6",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return "";
    return response.text();
  } catch {
    return "";
  }
}

function cardsFrom(html: string, kind: "movie" | "show") {
  const folder = kind === "movie" ? "watch" : "series";
  const pattern = new RegExp(
    `<a href="(https://3sk\\.quest/${folder}/[^"]+)"[^>]*title="([^"]*)"[\\s\\S]{0,2500}?data-image="([^"]+)"`,
    "g",
  );
  const seen = new Set<string>();
  const items: Card[] = [];
  for (const match of html.matchAll(pattern)) {
    const slug = slugFromHref(match[1], folder);
    const title = cleanTitle(match[2]);
    if (!slug || !title || seen.has(slug)) continue;
    seen.add(slug);
    items.push({ slug, title, poster: absUrl(match[3]), kind });
  }
  return items;
}

function toCard(card: Card): WatchCard {
  return {
    id: card.kind === "movie" ? movieId(card.slug) : showId(card.slug),
    title: card.title,
    poster: card.poster,
    backdrop: card.poster,
    overview: "",
    kind: card.kind,
  };
}

async function loadLists() {
  if (listed && Date.now() - listed.at < 10 * 60 * 1000) return listed;
  const [filmsHtml, seriesHtml] = await Promise.all([
    fetchText(`${ORIGIN}/category/1-movi-tr/`),
    fetchText(`${ORIGIN}/turk-series/`),
  ]);
  const films = cardsFrom(filmsHtml, "movie").slice(0, 36);
  const series = cardsFrom(seriesHtml, "show").slice(0, 48);
  if (!films.length && !series.length) throw new Error("Catalogue indisponible");
  listed = { at: Date.now(), films, series };
  return listed;
}

function meta(html: string, key: string) {
  const first = html.match(new RegExp(`<meta[^>]+property="${key}"[^>]+content="([^"]*)"`, "i"));
  const second = html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+property="${key}"`, "i"));
  return decode((first?.[1] || second?.[1] || "").trim());
}

function story(html: string) {
  const block = html.match(/class="story"[^>]*>([\s\S]*?)<\/div>/i);
  const raw = block ? block[1].replace(/<[^>]+>/g, " ") : meta(html, "og:description");
  return cleanTitle(raw).slice(0, 320);
}

function heading(html: string) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return cleanTitle(h1 ? h1[1] : meta(html, "og:title"));
}

function episodeSource(html: string) {
  const block = html.match(/id="epiList"([\s\S]*)$/i)?.[1];
  if (!block) return html;
  const end = block.search(/<footer|id="footer"/i);
  return end > 0 ? block.slice(0, end) : block;
}

function episodesFrom(html: string): ListedEpisode[] {
  const pattern = /<a href="(https:\/\/3sk\.quest\/watch\/[^"]+)"[^>]*title="([^"]*)"/g;
  const seen = new Set<string>();
  const rows: ListedEpisode[] = [];
  for (const match of episodeSource(html).matchAll(pattern)) {
    const slug = slugFromHref(match[1], "watch");
    const number = Number(decode(match[2]).match(/الحلقة\s*(\d+)/)?.[1] || "");
    if (!slug || seen.has(slug) || !Number.isInteger(number) || number < 1) continue;
    seen.add(slug);
    rows.push({ number, title: "Épisode", slug });
  }
  rows.sort((a, b) => a.number - b.number);
  return rows;
}

function seasonTabs(html: string) {
  const block = html.match(/<div class="seasonsTans"[\s\S]*?<\/ul>/i)?.[0] || "";
  const tabs: Array<{ key: string; number: number; active: boolean }> = [];
  for (const match of block.matchAll(/<li([^>]*)>([\s\S]*?)<\/li>/gi)) {
    const key = match[1].match(/data-id="(\d+)"/)?.[1] || "";
    const number = Number(match[2].match(/<em>(\d+)<\/em>/)?.[1] || "");
    if (!key || !Number.isInteger(number) || number < 1) continue;
    tabs.push({ key, number, active: /\bactive\b/.test(match[1]) });
  }
  tabs.sort((a, b) => a.number - b.number);
  return tabs;
}

function seasonButtons(slug: string, html: string) {
  const seriesId = showId(slug);
  const tabs = seasonTabs(html);
  if (tabs.length < 2) return [{ id: seriesId, title: "Saison" }];
  return tabs.map((tab, index) => ({
    id: index === 0 ? seriesId : showSeasonId(slug, tab.key),
    title: `Saison ${tab.number}`,
  }));
}

async function fetchSeasonEpisodes(seasonKey: string, seriesPostId: string, referer: string) {
  try {
    const body = new URLSearchParams({ season: seasonKey });
    if (seriesPostId) body.set("series", seriesPostId);
    const response = await fetch(`${ORIGIN}/wp-content/themes/esheeq-speed/Inc/Ajax/Single/Episodes.php`, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        Referer: referer,
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return [];
    return episodesFrom(await response.text());
  } catch {
    return [];
  }
}

async function episodesFor(slug: string, seasonKey: string, html: string) {
  const tabs = seasonTabs(html);
  const visible = episodesFrom(html);
  if (!tabs.length) return visible;
  const active = tabs.find((tab) => tab.active) || tabs[0];
  const target = seasonKey ? tabs.find((tab) => tab.key === seasonKey) : tabs[0];
  if (!target) throw new Error("Saison introuvable");
  if (target.key === active.key) return visible;
  const seriesPostId = html.match(/<body[^>]*data-id="(\d+)"/i)?.[1] || "";
  const posted = await fetchSeasonEpisodes(
    target.key,
    seriesPostId,
    `${ORIGIN}/series/${encodeURIComponent(slug)}/`,
  );
  if (!posted.length) throw new Error("Saison introuvable");
  return posted;
}

async function pageOf(kind: "movie" | "show", slug: string) {
  const folder = kind === "movie" ? "watch" : "series";
  return fetchText(`${ORIGIN}/${folder}/${encodeURIComponent(slug)}/`);
}

function unpackEval(html: string) {
  const packed = html.match(
    /eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\('((?:\\'|[^'])*)',(\d+),(\d+),'((?:\\'|[^'])*)'\.split\('\|'\)\)\)/,
  );
  if (!packed) return "";
  try {
    const payload = packed[1].replace(/\\'/g, "'");
    const radix = Number(packed[2]);
    const count = Number(packed[3]);
    const dictionary = packed[4].replace(/\\'/g, "'").split("|");
    if (!Number.isFinite(radix) || !Number.isFinite(count) || !dictionary.length) return "";
    let unpacked = payload;
    for (let i = count - 1; i >= 0; i -= 1) {
      const token = dictionary[i];
      if (!token) continue;
      unpacked = unpacked.replace(new RegExp(`\\b${i.toString(radix)}\\b`, "g"), token);
    }
    return unpacked;
  } catch {
    return "";
  }
}

function findMedia(source: string) {
  const text = source.replace(/\\\//g, "/").replace(/\\u0026/g, "&");
  const matches = text.match(/https?:\/\/[^"'\s<>]+?\.(?:m3u8|mp4)(?:\?[^"'\s<>]*)?/g) || [];
  const urls = [...new Set(matches.map((url) => url.replace(/\\+$/g, "")))];
  return [...urls.filter((url) => url.includes(".m3u8")), ...urls.filter((url) => !url.includes(".m3u8"))];
}

async function usableFirst(urls: string[]) {
  if (urls.length < 2) return urls;
  const { fetchMedia } = await import("./watch");
  const ok = await Promise.all(
    urls.map(async (url) => {
      try {
        const file = /\.mp4(\?|$)/i.test(url);
        const response = await fetchMedia(url, 8000, file ? { Range: "bytes=0-1" } : undefined);
        if (!response.ok) return false;
        if (!file) return (await response.text()).includes("#EXTM3U");
        await response.arrayBuffer().catch(() => undefined);
        return true;
      } catch {
        return false;
      }
    }),
  );
  const working = urls.filter((_, index) => ok[index]);
  const broken = urls.filter((_, index) => !ok[index]);
  return [
    ...working.filter((url) => url.includes(".m3u8")),
    ...working.filter((url) => !url.includes(".m3u8")),
    ...broken,
  ];
}

async function streamsFor(slug: string) {
  const see = await fetchOptional(`${ORIGIN}/watch/${encodeURIComponent(slug)}/see/`, `${ORIGIN}/`);
  if (!see) return [];
  const frames = [...see.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)]
    .map((match) => absUrl(decode(match[1])))
    .filter((src) => {
      try {
        return new URL(src).hostname !== "3sk.quest";
      } catch {
        return false;
      }
    });
  const found: string[] = [];
  for (const embed of frames.slice(0, 4)) {
    const html = await fetchOptional(embed, `${ORIGIN}/`);
    if (!html) continue;
    for (const url of findMedia(`${unpackEval(html)}\n${html}`)) {
      if (!found.includes(url)) found.push(url);
    }
    if (found.length >= 3) break;
  }
  return [...found.filter((url) => url.includes(".m3u8")), ...found.filter((url) => !url.includes(".m3u8"))].slice(0, 3);
}

export async function turkishCatalog(lang: "fr" | "en" = "fr"): Promise<WatchHome> {
  const { films, series } = await loadLists();
  const picks = [...films.slice(0, 4), ...series.slice(0, 2)];
  const hero = (
    await Promise.all(
      picks.map(async (card) => {
        const base = toCard(card);
        try {
          const html = await pageOf(card.kind, card.slug);
          const image = absUrl(meta(html, "og:image"));
          return {
            ...base,
            title: heading(html) || base.title,
            poster: base.poster || image,
            backdrop: image || base.poster,
            overview: story(html),
          };
        } catch {
          return base;
        }
      }),
    )
  ).filter((card) => card.title && (card.poster || card.backdrop));
  const rows = [
    { name: lang === "en" ? "Movies" : "Films", items: films.map(toCard) },
    { name: lang === "en" ? "Series" : "Séries", items: series.map(toCard) },
  ].filter((row) => row.items.length);
  if (!hero.length && !rows.length) throw new Error("Catalogue indisponible");
  return { hero, rows };
}

type WpItem = {
  slug?: string;
  link?: string;
  title?: { rendered?: string };
  _embedded?: { "wp:featuredmedia"?: Array<{ source_url?: string }> };
};

function wpCards(payload: unknown, kind: "movie" | "show") {
  if (!Array.isArray(payload)) return [];
  const folder = kind === "movie" ? "watch" : "series";
  const cards: Card[] = [];
  for (const entry of payload as WpItem[]) {
    const rawTitle = entry.title?.rendered || "";
    if (kind === "movie" && (/مسلسل|الحلقة/.test(rawTitle) || !/فيلم/.test(rawTitle))) continue;
    const slug = slugFromHref(entry.link || "", folder) || entry.slug || "";
    const title = cleanTitle(rawTitle);
    if (!slug || !title) continue;
    const poster = absUrl(entry._embedded?.["wp:featuredmedia"]?.[0]?.source_url || "");
    cards.push({ slug, title, poster, kind });
  }
  return cards;
}

async function searchRemote(query: string) {
  const encoded = encodeURIComponent(query);
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "application/json",
    "Accept-Language": "ar,fr;q=0.8,en;q=0.6",
  };
  const [seriesRes, filmRes] = await Promise.all([
    fetch(`${ORIGIN}/wp-json/wp/v2/series?search=${encoded}&per_page=12&_embed=wp:featuredmedia`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    }),
    fetch(`${ORIGIN}/wp-json/wp/v2/posts?search=${encoded}&per_page=12&_embed=wp:featuredmedia`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    }),
  ]);
  const series = seriesRes.ok ? wpCards(await seriesRes.json(), "show") : [];
  const films = filmRes.ok ? wpCards(await filmRes.json(), "movie") : [];
  return [...series, ...films];
}

function mergeCards(primary: Card[], extra: Card[]) {
  const seen = new Set<string>();
  const cards: Card[] = [];
  for (const card of [...primary, ...extra]) {
    const key = `${card.kind}:${card.slug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cards.push(card);
  }
  return cards.slice(0, 24);
}

export async function turkishSearch(query: string) {
  const needle = query.trim();
  if (needle.length < 2) return [];
  const local = await loadLists().catch(() => ({ films: [] as Card[], series: [] as Card[] }));
  const folded = needle.toLowerCase();
  const cached = [...local.series, ...local.films].filter((card) => card.title.toLowerCase().includes(folded));
  try {
    return mergeCards(await searchRemote(needle), cached).map(toCard);
  } catch {
    return cached.slice(0, 24).map(toCard);
  }
}

export async function turkishTitle(id: string): Promise<WatchTitle> {
  const kind = id.startsWith("tr-s-") ? "show" : "movie";
  const { slug, seasonKey } = parseId(id);
  const html = await pageOf(kind, slug);
  const episodes = kind === "show" ? await episodesFor(slug, seasonKey, html) : [];
  const title = heading(html) || slug;
  const poster = absUrl(meta(html, "og:image"));
  const year = title.match(/\b(?:19|20)\d{2}\b/)?.[0] || "";
  const seriesId = kind === "show" ? showId(slug) : id;
  return {
    id: seriesId,
    title,
    poster,
    backdrop: poster,
    overview: story(html),
    kind,
    seasons: kind === "show" ? seasonButtons(slug, html) : [],
    episodes: episodes.map(({ number, title: episodeTitle }) => ({ number, title: episodeTitle })),
    cast: [],
    genres: [],
    directors: [],
    year,
    runtime: "",
    quality: "",
  };
}

export async function turkishShow(id: string) {
  const data = await turkishTitle(id);
  return {
    poster: data.poster,
    seasons: data.seasons.length ? data.seasons : [{ id: showId(parseId(id).slug), title: "Saison" }],
    episodes: data.episodes,
  };
}

export async function turkishPlay(
  id: string,
  episode?: number,
  preferredServer?: string,
): Promise<WatchPlayResult> {
  const { slug, seasonKey } = parseId(id);
  let watch = slug;
  if (id.startsWith("tr-s-")) {
    if (!episode || episode < 1) throw new Error("Épisode introuvable");
    const episodes = await episodesFor(slug, seasonKey, await pageOf("show", slug));
    const hit = episodes.find((item) => item.number === episode);
    if (!hit) throw new Error("Épisode introuvable");
    watch = hit.slug;
  }
  const streams = await usableFirst(await streamsFor(watch));
  if (!streams.length) throw new Error("Lecture indisponible");
  const picked = streams.findIndex((_, index) => String(index + 1) === preferredServer);
  const chosen = picked >= 0 ? picked : 0;
  return {
    stream: streams[chosen],
    server: String(chosen + 1),
    servers: streams.map((_, index) => ({
      id: String(index + 1),
      label: index === 0 ? "Serveur" : `Serveur ${index + 1}`,
      version: "vf" as const,
    })),
    language: "unknown",
    version: "vf",
  };
}
