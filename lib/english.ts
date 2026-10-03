import type { WatchCard, WatchHome, WatchPlayResult, WatchResult, WatchTitle } from "./watch";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

type Kind = "sc" | "sx" | "rd";
type Image = { filename?: string; type?: string; lang?: string | null };
type ScTitle = {
  id: number;
  slug: string;
  name: string;
  type?: string;
  plot?: string;
  runtime?: number;
  release_date?: string;
  last_air_date?: string;
  tmdb_id?: number;
  images?: Image[];
  seasons?: { id: number; number: number; name?: string | null }[];
};
type ScEpisode = { id: number; number: number | string; name?: string };

let scHostCache: { value: string; cdn: string; at: number } | null = null;
let ridoHostCache: { value: string; at: number } | null = null;
let homeCache: { at: number; value: WatchHome } | null = null;

function headers(extra: Record<string, string> = {}) {
  return {
    "User-Agent": USER_AGENT,
    "Accept-Language": "en-US,en;q=0.9",
    Cookie: "language=en",
    ...extra,
  };
}

function norm(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sameTitle(left: string, right: string) {
  const a = norm(left);
  const b = norm(right);
  return Boolean(a && a === b);
}

function relatedTitle(query: string, title: string) {
  const wanted = norm(query);
  const found = norm(title);
  if (!wanted || !found) return false;
  if (found.includes(wanted) || wanted.includes(found)) return true;
  const words = wanted.split(" ").filter((word) => word.length > 2);
  return words.length > 0 && words.every((word) => found.includes(word));
}

function decodeHtml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function inertia(html: string) {
  const raw = html.match(/data-page="([^"]+)"/)?.[1];
  if (!raw) throw new Error("Playback unavailable");
  return JSON.parse(decodeHtml(raw)) as {
    props?: {
      cdn_url?: string;
      sliders?: { name?: string; titles?: ScTitle[] }[];
      title?: ScTitle;
      loadedSeason?: { episodes?: ScEpisode[] };
    };
  };
}

async function scInfo() {
  if (scHostCache && Date.now() - scHostCache.at < 30 * 60 * 1000) return scHostCache;
  const response = await fetch("https://streamingunity.cc/en", {
    headers: headers(),
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  const origin = new URL(response.url).origin;
  const html = await response.text();
  const cdn = inertia(html).props?.cdn_url || `https://cdn.${new URL(origin).host}`;
  scHostCache = { value: origin, cdn, at: Date.now() };
  return scHostCache;
}

async function ridoHost() {
  if (ridoHostCache && Date.now() - ridoHostCache.at < 30 * 60 * 1000) return ridoHostCache.value;
  const response = await fetch("https://ridomovies.su/", {
    headers: headers(),
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  const origin = new URL(response.url).origin;
  ridoHostCache = { value: origin, at: Date.now() };
  return origin;
}

function art(images: Image[] | undefined, cdn: string, type: string) {
  const list = images || [];
  const hit =
    list.find((item) => item.type === type && item.lang === "en" && item.filename) ||
    list.find((item) => item.type === type && item.filename);
  return hit?.filename ? `${cdn.replace(/\/$/, "")}/images/${hit.filename}` : "";
}

function scCard(item: ScTitle, cdn: string): WatchCard {
  const poster = art(item.images, cdn, "poster");
  const backdrop = art(item.images, cdn, "background") || poster;
  return {
    id: `en-sc-${item.id}-${item.slug}`,
    title: item.name,
    poster,
    backdrop,
    overview: item.plot || "",
    kind: item.type === "tv" ? "show" : "movie",
  };
}

function rowName(name: string) {
  const key = name.toLowerCase();
  if (key.includes("top")) return "Top 10";
  if (key.includes("latest") || key.includes("new")) return "New";
  if (key.includes("trend")) return "Trending";
  return "Popular";
}

function keepEnglish(item: ScTitle) {
  return !/stagione\s*\d+/i.test(item.name || "");
}

export async function englishHome(): Promise<WatchHome> {
  if (homeCache && Date.now() - homeCache.at < 10 * 60 * 1000) return homeCache.value;
  const info = await scInfo();
  const response = await fetch(`${info.value}/en`, {
    headers: headers(),
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("Playback unavailable");
  const sliders = inertia(await response.text()).props?.sliders || [];
  const heroSlider = sliders.find((slider) => /trend/i.test(slider.name || "")) || sliders[0];
  const hero = (heroSlider?.titles || []).filter(keepEnglish).slice(0, 8).map((item) => scCard(item, info.cdn));
  const rows = sliders
    .filter((slider) => slider !== heroSlider)
    .map((slider) => ({
      name: rowName(slider.name || ""),
      items: (slider.titles || []).filter(keepEnglish).slice(0, 24).map((item) => scCard(item, info.cdn)),
    }))
    .filter((row) => row.items.length);
  const value = { hero, rows };
  if (!hero.length && !rows.length) throw new Error("Playback unavailable");
  homeCache = { at: Date.now(), value };
  return value;
}

async function searchSc(query: string): Promise<WatchResult[]> {
  const info = await scInfo();
  const response = await fetch(
    `${info.value}/en/search?q=${encodeURIComponent(query)}&lang=en`,
    { headers: headers({ Accept: "application/json" }), cache: "no-store", signal: AbortSignal.timeout(8000) },
  );
  if (!response.ok) return [];
  const data = (await response.json()) as { data?: ScTitle[] };
  return (data.data || []).filter(keepEnglish).slice(0, 24).map((item) => {
    const card = scCard(item, info.cdn);
    return { id: card.id, title: card.title, poster: card.poster, kind: card.kind };
  });
}

async function searchSflix(query: string): Promise<WatchResult[]> {
  const response = await fetch(`https://sflix.bz/search/${encodeURIComponent(query)}`, {
    headers: headers(),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return [];
  const html = await response.text();
  const results: WatchResult[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(
    /<div class="poster">([\s\S]*?)<div class="meta">([\s\S]*?)<a href="https:\/\/sflix\.bz\/([a-z0-9-]+)\/">([^<]+)<\/a>/gi,
  )) {
    const slug = match[3];
    const title = decodeHtml(match[4]).trim();
    if (!slug || !title || seen.has(slug)) continue;
    seen.add(slug);
    const poster = match[1].match(/data-src="(https:[^"]+)"/)?.[1] || "";
    const show = /class="type">\s*(TV|Series)/i.test(match[2]);
    results.push({ id: `en-sx-${slug}`, title, poster, kind: show ? "show" : "movie" });
    if (results.length >= 16) break;
  }
  return results.filter((item) => relatedTitle(query, item.title));
}

type RidoHit = { slug: string; title: string; tmdbId?: number; poster: string; kind: WatchResult["kind"] };

async function ridoHits(query: string): Promise<RidoHit[]> {
  const origin = await ridoHost();
  const response = await fetch(
    `${origin}/api/search?q=${encodeURIComponent(query)}&page=1&lang=en&limit=12`,
    { headers: headers({ Accept: "application/json" }), cache: "no-store", signal: AbortSignal.timeout(8000) },
  );
  if (!response.ok) return [];
  const data = (await response.json()) as {
    data?: { title?: string; slug?: string; type?: string; poster_path?: string; tmdb_id?: number }[];
  };
  return (data.data || []).slice(0, 12).flatMap((item) => {
    const slug = item.slug || "";
    if (!slug || !item.title) return [];
    const poster = item.poster_path?.startsWith("http")
      ? item.poster_path
      : item.poster_path
        ? `${origin}${item.poster_path.startsWith("/") ? "" : "/"}${item.poster_path}`
        : "";
    return [{ slug, title: item.title, tmdbId: item.tmdb_id, poster, kind: item.type === "tv" ? "show" as const : "movie" as const }];
  });
}

async function searchRido(query: string): Promise<WatchResult[]> {
  const hits = await ridoHits(query);
  return hits
    .filter((item) => relatedTitle(query, item.title))
    .map((item) => ({ id: `en-rd-${item.slug}`, title: item.title, poster: item.poster, kind: item.kind }));
}

export async function englishSearch(query: string): Promise<WatchResult[]> {
  const [first, second, third] = await Promise.all([
    searchSc(query).catch(() => [] as WatchResult[]),
    searchSflix(query).catch(() => [] as WatchResult[]),
    searchRido(query).catch(() => [] as WatchResult[]),
  ]);
  const seen = new Set<string>();
  const results: WatchResult[] = [];
  for (const item of [...first, ...second, ...third]) {
    const key = norm(item.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    results.push(item);
  }
  return results;
}

function parseEnglishId(id: string): { kind: Kind; key: string; season: number } | null {
  const match = id.match(/^en-(sc|sx|rd)-([a-z0-9][a-z0-9_-]*?)(?:~(\d+))?$/i);
  if (!match) return null;
  return { kind: match[1].toLowerCase() as Kind, key: match[2], season: Number(match[3] || 1) };
}

async function scPage(slug: string, season = 1) {
  const info = await scInfo();
  const path = season > 1 ? `/en/titles/${slug}/season-${season}` : `/en/titles/${slug}`;
  const response = await fetch(`${info.value}${path}`, {
    headers: headers(),
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("Playback unavailable");
  const page = inertia(await response.text());
  return { info, page };
}

function episodesOf(page: ReturnType<typeof inertia>) {
  return (page.props?.loadedSeason?.episodes || [])
    .map((episode) => ({
      id: episode.id,
      number: Number(episode.number),
      title: episode.name || `Episode ${episode.number}`,
    }))
    .filter((episode) => episode.number > 0)
    .sort((a, b) => a.number - b.number);
}

export async function englishTitle(id: string, kind: WatchResult["kind"]): Promise<WatchTitle> {
  const parsed = parseEnglishId(id);
  if (!parsed) throw new Error("Playback unavailable");
  if (parsed.kind === "sc") {
    const { info, page } = await scPage(parsed.key, 1);
    const title = page.props?.title;
    if (!title) throw new Error("Playback unavailable");
    const card = scCard(title, info.cdn);
    const show = title.type === "tv" || kind === "show";
    const seasons = show
      ? (title.seasons || []).map((season) => ({
          id: season.number > 1 ? `${card.id}~${season.number}` : card.id,
          title: `Season ${season.number}`,
        }))
      : [];
    return {
      ...card,
      kind: show ? "show" : "movie",
      seasons: seasons.length ? seasons : show ? [{ id: card.id, title: "Season 1" }] : [],
      episodes: show ? episodesOf(page).map(({ number, title: name }) => ({ number, title: name })) : [],
      cast: [],
      genres: [],
      directors: [],
      year: (title.release_date || title.last_air_date || "").slice(0, 4),
      runtime: title.runtime ? `${title.runtime} min` : "",
      quality: "",
    };
  }
  const found = (await (parsed.kind === "sx" ? searchSflix(parsed.key.replace(/-/g, " ")) : searchRido(parsed.key.replace(/-/g, " "))))
    .find((item) => item.id === id || item.id.startsWith(id));
  const title = found?.title || parsed.key.replace(/-/g, " ");
  const show = found?.kind === "show" || kind === "show";
  return {
    id,
    title,
    poster: found?.poster || "",
    backdrop: found?.poster || "",
    overview: "",
    kind: show ? "show" : "movie",
    seasons: show ? [{ id, title: "Season 1" }] : [],
    episodes: show ? [{ number: 1, title: "Episode 1" }] : [],
    cast: [],
    genres: [],
    directors: [],
    year: "",
    runtime: "",
    quality: "",
  };
}

export async function englishShow(id: string) {
  const parsed = parseEnglishId(id);
  if (!parsed) throw new Error("Playback unavailable");
  if (parsed.kind !== "sc") {
    return { poster: "", seasons: [{ id, title: "Season 1" }], episodes: [{ number: 1, title: "Episode 1" }] };
  }
  const { info, page } = await scPage(parsed.key, parsed.season);
  const title = page.props?.title;
  return {
    poster: title ? art(title.images, info.cdn, "poster") : "",
    seasons: [{ id, title: `Season ${parsed.season}` }],
    episodes: episodesOf(page).map(({ number, title: name }) => ({ number, title: name })),
  };
}

async function within<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } catch {
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function unpack(html: string) {
  const packed = html.match(
    /eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\('((?:\\'|[^'])*)',(\d+),(\d+),'((?:\\'|[^'])*)'\.split\('\|'\)\)\)/,
  );
  if (!packed) return "";
  try {
    const payload = packed[1].replace(/\\'/g, "'");
    const radix = Number(packed[2]);
    const count = Number(packed[3]);
    const dictionary = packed[4].replace(/\\'/g, "'").split("|");
    let unpacked = payload;
    for (let index = count - 1; index >= 0; index -= 1) {
      const token = dictionary[index];
      if (!token) continue;
      unpacked = unpacked.replace(new RegExp(`\\b${index.toString(radix)}\\b`, "g"), token);
    }
    return unpacked;
  } catch {
    return "";
  }
}

function findMedia(source: string) {
  const match = source.match(/https?:\/\/[^"'\\\s]+\/[^"'\\\s]+\.m3u8[^"'\\\s]*/);
  return match?.[0]?.replace(/\\\//g, "/") || "";
}

async function grabStream(url: string, referer: string): Promise<string> {
  const response = await fetch(url, {
    headers: headers({ Referer: referer }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return "";
  const html = await response.text();
  const direct = findMedia(html) || findMedia(unpack(html));
  if (direct) return direct;
  const frame = html.match(/<iframe[^>]+src="([^"]+)"/i)?.[1];
  if (!frame || frame.startsWith("about:")) return "";
  const next = decodeHtml(frame);
  if (!next.startsWith("http") || next === url) return "";
  const nested = await fetch(next, {
    headers: headers({ Referer: url }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!nested.ok) return "";
  const body = await nested.text();
  return findMedia(body) || findMedia(unpack(body));
}

async function openVixcloud(embedUrl: string, referer: string) {
  const page = await fetch(embedUrl, {
    headers: headers({ Referer: referer }),
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!page.ok) return "";
  const html = await page.text();
  const id = html.match(/window\.video\s*=\s*\{[\s\S]*?id:\s*'(\d+)'/)?.[1];
  const token = html.match(/['"]token['"]:\s*'([^']+)'/)?.[1];
  const expires = html.match(/['"]expires['"]:\s*'([^']+)'/)?.[1];
  if (!id || !token || !expires) return "";
  const host = new URL(embedUrl).origin;
  const playlist = new URL(`${host}/playlist/${id}`);
  playlist.searchParams.set("b", "1");
  playlist.searchParams.set("token", token);
  playlist.searchParams.set("expires", expires);
  playlist.searchParams.set("language", "en");
  return playlist.toString();
}

async function openSc(slug: string, episodeId?: number) {
  const info = await scInfo();
  const numeric = slug.split("-")[0];
  const iframe = episodeId
    ? `${info.value}/en/iframe/${slug}?episode_id=${episodeId}&next_episode=1&language=en`
    : `${info.value}/en/iframe/${numeric}?language=en`;
  const response = await fetch(iframe, {
    headers: headers({ Referer: `${info.value}/en` }),
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) return "";
  const src = decodeHtml(await response.text()).match(/<iframe[^>]+src="(https:[^"]+)"/i)?.[1];
  if (!src) return "";
  return openVixcloud(src, iframe);
}

async function openSflix(slug: string) {
  const page = await fetch(`https://sflix.bz/${slug}/`, {
    headers: headers(),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!page.ok) return "";
  const html = await page.text();
  const embeds = [
    html.match(/"premium":"(https:[^"]+)"/)?.[1],
    html.match(/"superembed":"(https:[^"]+)"/)?.[1],
    html.match(/"vidsrc":"(https:[^"]+)"/)?.[1],
    html.match(/"embedru":"(https:[^"]+)"/)?.[1],
  ].filter((url): url is string => Boolean(url));
  for (const embed of embeds) {
    const stream = await grabStream(embed.replace(/\\\//g, "/"), `https://sflix.bz/${slug}/`);
    if (stream) return stream;
  }
  return "";
}

async function openRido(slug: string, show: boolean, episode = 1) {
  const origin = await ridoHost();
  const path = show ? `/tv/${slug}/season-1/episode-${episode}` : `/movie/${slug}`;
  const response = await fetch(`${origin}${path}`, {
    headers: headers({ Referer: `${origin}/` }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return "";
  const html = await response.text();
  const raw = html.match(/id="player-cover"[^>]*data-embed="([^"]*)"/)?.[1] || "";
  const src = decodeHtml(raw).match(/src="(https:[^"]+)"/)?.[1];
  if (!src) return "";
  return grabStream(src, `${origin}/`);
}

async function scEpisodeId(slug: string, season: number, episode: number) {
  const { page } = await scPage(slug, season);
  return episodesOf(page).find((item) => item.number === episode)?.id;
}

export async function englishPlay(
  id: string,
  episode: number | undefined,
  preferredServer?: string,
): Promise<WatchPlayResult> {
  const parsed = parseEnglishId(id);
  if (!parsed) throw new Error("Playback unavailable");
  const show = Boolean(episode && episode > 0);
  let scSlug = parsed.kind === "sc" ? parsed.key : "";
  let sxSlug = parsed.kind === "sx" ? parsed.key : "";
  let rdSlug = parsed.kind === "rd" ? parsed.key : "";
  let title = parsed.key.replace(/-/g, " ");
  let episodeId: number | undefined;
  let tmdbId = 0;

  if (parsed.kind === "sc") {
    const { page } = await scPage(parsed.key, parsed.season);
    title = page.props?.title?.name || title;
    tmdbId = Number(page.props?.title?.tmdb_id || 0);
    if (show) episodeId = await scEpisodeId(parsed.key, parsed.season, episode || 1);
  }

  const order: Kind[] = parsed.kind === "sx" ? ["sx", "sc", "rd"] : parsed.kind === "rd" ? ["rd", "sc", "sx"] : ["sc", "sx", "rd"];
  const openers: Record<Kind, () => Promise<string>> = {
    sc: async () => {
      if (!scSlug && title) {
        const hit = (await searchSc(title).catch(() => [])).find((item) => sameTitle(item.title, title));
        scSlug = hit?.id.replace(/^en-sc-/, "") || "";
      }
      if (!scSlug) return "";
      return openSc(scSlug, episodeId);
    },
    sx: async () => {
      if (!sxSlug && title) {
        const hit = (await searchSflix(title).catch(() => [])).find((item) => sameTitle(item.title, title));
        sxSlug = hit?.id.replace(/^en-sx-/, "") || "";
      }
      return sxSlug ? openSflix(sxSlug) : "";
    },
    rd: async () => {
      if (!rdSlug && title) {
        const hits = await ridoHits(title).catch(() => []);
        const hit =
          (tmdbId ? hits.find((item) => item.tmdbId === tmdbId) : undefined) ||
          hits.find((item) => sameTitle(item.title, title));
        rdSlug = hit?.slug || "";
      }
      return rdSlug ? openRido(rdSlug, show, episode || 1) : "";
    },
  };

  const lookups = await Promise.all(
    order.map(async (kind) => {
      if (kind === "sx" && !sxSlug) {
        const hit = await within(
          searchSflix(title).then((items) => items.find((item) => sameTitle(item.title, title)) || null).catch(() => null),
          4000,
          null,
        );
        if (hit) sxSlug = hit.id.replace(/^en-sx-/, "");
      }
      if (kind === "rd" && !rdSlug) {
        const hit = await within(
          ridoHits(title)
            .then((items) => (tmdbId ? items.find((item) => item.tmdbId === tmdbId) : undefined) || items.find((item) => sameTitle(item.title, title)) || null)
            .catch(() => null),
          4000,
          null,
        );
        if (hit) rdSlug = hit.slug;
      }
      const present = kind === "sc" ? Boolean(scSlug) : kind === "sx" ? Boolean(sxSlug) : Boolean(rdSlug);
      return present ? kind : null;
    }),
  );
  const available = lookups.filter((kind): kind is Kind => Boolean(kind));
  const tryOrder = preferredServer && available.includes(preferredServer as Kind)
    ? [preferredServer as Kind, ...available.filter((kind) => kind !== preferredServer)]
    : available;
  let picked: { kind: Kind; stream: string } | null = null;
  for (const kind of tryOrder) {
    const stream = await within(openers[kind]().catch(() => ""), 12000, "");
    if (!stream) continue;
    picked = { kind, stream };
    if (!preferredServer || kind === preferredServer) break;
  }
  if (!picked?.stream) throw new Error("Playback unavailable");
  const servers = available.map((kind, index) => ({
    id: kind,
    label: index === 0 ? "Server" : `Server ${index + 1}`,
    version: "vo" as const,
  }));
  return {
    stream: picked.stream,
    server: picked.kind,
    servers,
    language: "en",
    version: "vo",
  };
}
