const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

const PORTAL = "https://fstream.info/";
const FALLBACK_ORIGIN = "https://fs16.lol";

export type WatchResult = {
  id: string;
  title: string;
  poster: string;
  kind: "movie" | "show";
  source?: string;
};

let cachedOrigin: { value: string; at: number } | null = null;

export async function catalogOrigin() {
  if (cachedOrigin && Date.now() - cachedOrigin.at < 10 * 60 * 1000) {
    return cachedOrigin.value;
  }
  try {
    const html = await fetch(PORTAL, {
      headers: { "User-Agent": USER_AGENT },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    }).then((response) => response.text());
    const match = html.match(/href="(https:\/\/fs\d+\.lol)\/?"/);
    const value = match?.[1] || FALLBACK_ORIGIN;
    cachedOrigin = { value, at: Date.now() };
    return value;
  } catch {
    return cachedOrigin?.value || FALLBACK_ORIGIN;
  }
}

function headers(origin: string) {
  return {
    "User-Agent": USER_AGENT,
    Cookie: "dle_skin=VFV1",
    Referer: `${origin}/`,
    "Accept-Language": "fr-FR,fr;q=0.9",
    "X-Requested-With": "XMLHttpRequest",
  };
}

export type WatchCard = WatchResult & {
  overview: string;
  backdrop: string;
};

export type WatchHomeRow = {
  name: string;
  items: WatchCard[];
  seeAll?: string;
};

export type WatchHome = {
  hero: WatchCard[];
  rows: WatchHomeRow[];
};

let cachedHome: { at: number; value: WatchHome } | null = null;

export async function homeCatalog(): Promise<WatchHome> {
  if (cachedHome && Date.now() - cachedHome.at < 10 * 60 * 1000) return cachedHome.value;
  const value = await streamHome();
  if (!value.hero.length && !value.rows.length) throw new Error("Catalogue indisponible");
  cachedHome = { at: Date.now(), value };
  return value;
}

const MANGA_ORIGIN = "https://w16.french-manga.net";
const ANIME_ORIGIN = "https://french-anime.com";

export function isWatchId(id: string) {
  return (
    /^\d+$/.test(id) ||
    /^m-\d+$/.test(id) ||
    /^a-[a-z0-9][a-z0-9_-]*$/i.test(id) ||
    /^en-(sc|sx|rd)-[a-z0-9][a-z0-9~_-]*$/i.test(id)
  );
}

function animeWatchId(href: string) {
  const path = href
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\//, "")
    .replace(/\.html$/i, "")
    .replace(/\/+$/, "");
  if (!path || path.includes("..")) return "";
  return `a-${path.replace(/\//g, "__")}`;
}

function mangaHeaders() {
  return {
    "User-Agent": USER_AGENT,
    Cookie: "dle_skin=MGM",
    Referer: `${MANGA_ORIGIN}/`,
    "Accept-Language": "fr-FR,fr;q=0.9",
    "X-Requested-With": "XMLHttpRequest",
  };
}

function absUrl(origin: string, src: string) {
  if (!src) return "";
  if (src.startsWith("http")) return src;
  if (src.startsWith("//")) return `https:${src}`;
  const base = origin.replace(/\/$/, "");
  return src.startsWith("/") ? `${base}${src}` : `${base}/${src}`;
}

function parseShortBlock(block: string, origin: string, kind: WatchResult["kind"]): WatchCard[] {
  const items: WatchCard[] = [];
  for (const piece of block.split(/class="short"/).slice(1)) {
    const title = decodeTitle(piece.match(/class="short-title">([^<]+)/)?.[1] || "");
    const poster = absUrl(origin, piece.match(/<img[^>]+src="([^"]+)"/)?.[1] || "");
    const href =
      piece.match(/class="[^"]*short-poster[^"]*"[^>]*href="([^"]+)"/)?.[1] ||
      piece.match(/href="([^"]+)"[^>]*class="[^"]*short-poster[^"]*"/)?.[1] ||
      "";
    const modalId = piece.match(/openModal\('(\d+)'\)/)?.[1] || "";
    const newsId = piece.match(/newsid=(\d+)/)?.[1] || "";
    const slug = href.split("/").filter(Boolean).pop()?.split("?")[0] || "";
    const id = modalId || newsId || (/^\d+/.test(slug) ? slug : "") || "";
    if (!id || !title) continue;
    items.push({ id, title, poster, overview: "", backdrop: poster, kind });
  }
  return uniqueByTitle(items);
}

async function catalogPages(kind: WatchResult["kind"], pages: number) {
  const lists = await Promise.all(
    Array.from({ length: pages }, (_, index) =>
      listCatalog(kind, index + 1)
        .then((list) => list.items)
        .catch(() => [] as WatchCard[]),
    ),
  );
  return lists.flat();
}

/** Enough posters to fill a wide screen, then another full row underneath. */
function wideRows(items: WatchCard[], names: string[]): WatchHomeRow[] {
  const size = 18;
  const rows: WatchHomeRow[] = [];
  for (let index = 0; index < items.length && rows.length < names.length; index += size) {
    const slice = items.slice(index, index + size);
    if (slice.length < 10 && rows.length) {
      rows[rows.length - 1].items = [...rows[rows.length - 1].items, ...slice];
      break;
    }
    rows.push({ name: names[rows.length], items: slice });
  }
  return rows;
}

/** Provider home, then more pages of the same films and series so a wide screen is full. */
async function streamHome(): Promise<WatchHome> {
  const origin = await catalogOrigin();
  const response = await fetch(`${origin}/`, {
    headers: headers(origin),
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("Catalogue indisponible");
  const html = await response.text();
  const blocks = html.split(/class="pages clearfix"/).slice(1);
  const [homeFilms, homeSeries, moreFilms, moreSeries] = await Promise.all([
    Promise.resolve(parseShortBlock(blocks[0] || "", origin, "movie")),
    Promise.resolve(parseShortBlock(blocks[1] || "", origin, "show")),
    catalogPages("movie", 4),
    catalogPages("show", 4),
  ]);
  const films = uniqueByTitle([...homeFilms, ...moreFilms]).slice(0, 54);
  const series = uniqueByTitle([...homeSeries, ...moreSeries]).slice(0, 54);
  const hero: WatchCard[] = [];
  for (let index = 0; hero.length < 8 && (index < series.length || index < films.length); index += 1) {
    if (series[index]) hero.push(series[index]);
    if (hero.length < 8 && films[index]) hero.push(films[index]);
  }
  const seriesRows = wideRows(series, ["Séries", "Plus de séries", "Autres séries"]);
  const filmRows = wideRows(films, ["Films", "Plus de films", "Autres films"]);
  const rows: WatchHomeRow[] = [];
  const span = Math.max(seriesRows.length, filmRows.length);
  for (let index = 0; index < span; index += 1) {
    if (seriesRows[index]) rows.push(seriesRows[index]);
    if (filmRows[index]) rows.push(filmRows[index]);
  }
  return { hero, rows };
}

function rowTitle(raw: string) {
  const name = decodeTitle(raw)
    .replace(/french\s*(stream|manga|anime)|wiflix|vavoo|frembed/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return name || "Animés";
}

function posterSrc(block: string) {
  return (
    block.match(/<img[^>]+src="([^"]+)"/i)?.[1] ||
    block.match(/<img[^>]+data-src="([^"]+)"/i)?.[1] ||
    ""
  );
}

function visibleTitle(raw: string) {
  return rowTitle(raw).replace(/\bwiflix\b/gi, "").replace(/\s+/g, " ").trim();
}

async function mangaRows(): Promise<WatchHomeRow[]> {
  const origin = "https://w16.french-manga.net";
  try {
    const response = await fetch(`${origin}/`, {
      headers: {
        "User-Agent": USER_AGENT,
        Cookie: "dle_skin=MGM",
        Referer: `${origin}/`,
        "Accept-Language": "fr-FR,fr;q=0.9",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return [];
    const html = await response.text();
    const rows: WatchHomeRow[] = [];
    for (const sect of html.split(/class="st-left"/).slice(1)) {
      const name = visibleTitle(sect.match(/class="st-capt"[^>]*>([^<]+)/)?.[1] || "Animés");
      const items: WatchCard[] = [];
      for (const card of sect.split(/class="short-in/).slice(1)) {
        const title = visibleTitle(card.match(/class="short-title"[^>]*>([^<]+)/)?.[1] || "");
        const type = decodeTitle(card.match(/class="mli-type"[\s\S]{0,240}?>([^<]+)</)?.[1] || "");
        const href = card.match(/class="short-poster[^"]*"[^>]*href="([^"]+)"/)?.[1] || "";
        const poster = absUrl(origin, posterSrc(card));
        const id = href.match(/newsid=(\d+)/)?.[1] || "";
        if (!title || !id || !poster) continue;
        const kind: WatchResult["kind"] = /^film$/i.test(type.trim()) ? "movie" : "show";
        items.push({ id: `m-${id}`, title, poster, overview: "", backdrop: poster, kind });
      }
      const unique = uniqueByTitle(items).slice(0, 36);
      if (unique.length) rows.push({ name, items: unique });
    }
    return rows;
  } catch {
    return [];
  }
}

async function animeSiteRows(): Promise<{ hero: WatchCard[]; rows: WatchHomeRow[] }> {
  const origin = "https://french-anime.com";
  try {
    const response = await fetch(`${origin}/`, {
      headers: { "User-Agent": USER_AGENT, Referer: `${origin}/`, "Accept-Language": "fr-FR,fr;q=0.9" },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return { hero: [], rows: [] };
    const html = await response.text();
    const hero: WatchCard[] = [];
    for (const item of html.split(/class="item"/).slice(1, 12)) {
      const href = item.match(/<a[^>]+href="([^"]+\.html)"/)?.[1] || "";
      const shortTitle = visibleTitle(item.match(/class="title1"[^>]*>([^<]+)/)?.[1] || "");
      const alt = visibleTitle(item.match(/<img[^>]+alt="([^"]+)"/)?.[1] || "");
      const title = alt.length > shortTitle.length ? alt : shortTitle;
      const poster = absUrl(origin, posterSrc(item));
      const id = animeWatchId(href);
      if (!title || !id || !poster) continue;
      hero.push({ id, title, poster, overview: "", backdrop: poster, kind: "show" });
    }
    const rows: WatchHomeRow[] = [];
    for (const block of html.split(/class="block-main"/).slice(1)) {
      const name = visibleTitle(block.match(/class="left-ma[^"]*"[^>]*>([^<]+)/)?.[1] || "Animés");
      const items: WatchCard[] = [];
      for (const mov of block.split(/class="mov(?:\s|")/).slice(1)) {
        const href = mov.match(/class="mov-t[^"]*"[^>]*href="([^"]+)"/)?.[1] || "";
        const title = visibleTitle(mov.match(/class="mov-t[^"]*"[^>]*>([^<]+)/)?.[1] || "");
        const poster = absUrl(origin, posterSrc(mov));
        const id = animeWatchId(href);
        if (!title || !id || !poster) continue;
        const kind: WatchResult["kind"] = /film/i.test(name) ? "movie" : "show";
        items.push({ id: `a-${id}`, title, poster, overview: "", backdrop: poster, kind });
      }
      const unique = uniqueByTitle(items).slice(0, 36);
      if (unique.length) rows.push({ name, items: unique });
    }
    return { hero: uniqueByTitle(hero).filter((item) => item.poster).slice(0, 8), rows };
  } catch {
    return { hero: [], rows: [] };
  }
}

let cachedAnime: { at: number; value: WatchHome } | null = null;

/** Both anime catalogs stacked. The first copy of a title wins. */
export async function animeCatalog(): Promise<WatchHome> {
  if (cachedAnime && Date.now() - cachedAnime.at < 10 * 60 * 1000) return cachedAnime.value;
  const [manga, anime] = await Promise.all([mangaRows(), animeSiteRows()]);
  const seen = new Set<string>();
  const take = <T extends { title: string }>(items: T[]) =>
    items.filter((item) => {
      const key = titleKey(item.title);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const hero = uniqueByTitle([...anime.hero, ...manga.flatMap((row) => row.items.slice(0, 1))])
    .filter((item) => item.poster)
    .slice(0, 8);
  const rows = [...manga, ...anime.rows]
    .map((row) => ({ ...row, name: rowTitle(row.name), items: take(row.items) }))
    .filter((row) => row.items.length > 0);
  const value: WatchHome = { hero, rows };
  if (!value.hero.length && !value.rows.length) throw new Error("Catalogue indisponible");
  cachedAnime = { at: Date.now(), value };
  return value;
}

const EXTRA_SERIES = [
  ["Chernobyl"],
  ["Succession"],
  ["Sherlock"],
  ["Lost"],
  ["Narcos"],
  ["Suits"],
  ["The Office"],
  ["True Detective"],
  ["The Mandalorian", "Mandalorian"],
  ["Shogun"],
  ["The Bear"],
  ["Fallout"],
];

const EXTRA_FILMS = [
  ["Intouchables"],
  ["Seven"],
  ["Shutter Island"],
  ["Loup de Wall Street"],
  ["Django"],
];

const CURATED_SERIES = [
  ["Game of Thrones", "Trône de fer"],
  ["House of the Dragon"],
  ["Casa de Papel"],
  ["Ozark"],
  ["Breaking Bad"],
  ["Better Call Saul"],
  ["Stranger Things"],
  ["Peaky Blinders"],
  ["The Boys"],
  ["The Last of Us"],
  ["Squid Game"],
  ["Mercredi", "Wednesday"],
  ["Lupin"],
  ["Dark"],
  ["Vikings"],
  ["Prison Break"],
  ["The Witcher", "Witcher"],
  ["Black Mirror"],
  ["Friends"],
  ["Dexter"],
  ["The Walking Dead"],
  ["Arcane"],
  ...EXTRA_SERIES,
];

const CURATED_FILMS = [
  ["Matrix"],
  ["Seigneur des anneaux"],
  ["Equalizer"],
  ["Inception"],
  ["Interstellar"],
  ["Avatar"],
  ["Dark Knight"],
  ["Gladiator"],
  ["Titanic"],
  ["Joker"],
  ["Dune"],
  ["Top Gun"],
  ["Oppenheimer"],
  ["John Wick"],
  ["Mission Impossible"],
  ["Fast and Furious", "Fast & Furious"],
  ["Mad Max"],
  ["Jason Bourne"],
  ["Avengers"],
  ["Spider-Man", "Spider Man"],
  ["Deadpool"],
  ["Iron Man"],
  ["Harry Potter"],
  ["Pirates des Caraibes", "Pirates des Caraïbes"],
  ["Jurassic Park"],
  ["Fight Club"],
  ["Pulp Fiction"],
  ["Forrest Gump"],
  ["Le Parrain", "Parrain"],
  ...EXTRA_FILMS,
];

const HERO_PICKS: { series: boolean; aliases: string[] }[] = [
  { series: true, aliases: CURATED_SERIES[0] },
  { series: false, aliases: CURATED_FILMS[0] },
  { series: true, aliases: CURATED_SERIES[4] },
  { series: false, aliases: CURATED_FILMS[6] },
  { series: true, aliases: CURATED_SERIES[6] },
  { series: false, aliases: CURATED_FILMS[3] },
  { series: true, aliases: CURATED_SERIES[9] },
  { series: false, aliases: CURATED_FILMS[7] },
];

const curatedCache = new Map<string, WatchCard | null>();
const curatedInflight = new Map<string, Promise<WatchCard | null>>();

function foldName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/\s*[-–:]?\s*saison\s*\d+.*/i, "")
    .replace(/^(the|le|la|les)\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cleanDisplayTitle(title: string) {
  return title
    .replace(/\s*[-–:]\s*saison\s*\d+.*$/i, "")
    .replace(/\s+saison\s*\d+.*$/i, "")
    .replace(/\s*\(\d{4}\)\s*$/, "")
    .trim();
}

let searchChain: Promise<void> = Promise.resolve();
let searchAt = 0;

function paceSearch<T>(run: () => Promise<T>) {
  const job = searchChain.then(async () => {
    const wait = Math.max(0, 220 - (Date.now() - searchAt));
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    searchAt = Date.now();
    return run();
  });
  searchChain = job.then(
    () => undefined,
    () => undefined,
  );
  return job;
}

async function searchTitles(query: string): Promise<WatchResult[]> {
  return paceSearch(() => searchTitlesNow(query));
}

async function deadline<T>(ms: number, run: (signal: AbortSignal) => Promise<T>, fallback: T): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await run(controller.signal);
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

async function searchTitlesNow(query: string, signal?: AbortSignal, attempts = 4): Promise<WatchResult[]> {
  const origin = await catalogOrigin();
  let response: Response | null = null;
  const tries = Math.max(1, attempts);
  for (let attempt = 0; attempt < tries; attempt += 1) {
    response = await fetch(`${origin}/engine/ajax/search.php`, {
      method: "POST",
      headers: {
        ...headers(origin),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ query, page: "1" }),
      cache: "no-store",
      signal,
    });
    if (response.status !== 429 && response.status !== 503) break;
    if (attempt === tries - 1) break;
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  if (!response?.ok) throw new Error("Recherche impossible");
  const html = await response.text();
  const results: WatchResult[] = [];
  const pattern =
    /<div class='search-item' onclick="location\.href='([^']+)'"[\s\S]*?<img src='([^']*)'[\s\S]*?<div class='search-title'>([^<]+)/g;
  for (const match of html.matchAll(pattern)) {
    const href = match[1];
    const title = decodeTitle(match[3]);
    const id = href.match(/\/(\d+)-/)?.[1];
    if (!id || !title || title === "null") continue;
    const rawPoster = match[2];
    const poster = rawPoster.startsWith("http")
      ? rawPoster
      : `${origin}${rawPoster.startsWith("/") ? "" : "/"}${rawPoster}`;
    const show = /saison/i.test(href) || /saison/i.test(title);
    results.push({ id, title, poster, kind: show ? "show" : "movie" });
  }
  return results;
}

async function resolveCurated(aliases: string[], series: boolean): Promise<WatchCard | null> {
  const cacheKey = `${series ? "show" : "movie"}:${aliases.join("|").toLowerCase()}`;
  if (curatedCache.has(cacheKey)) return curatedCache.get(cacheKey) ?? null;
  const pending = curatedInflight.get(cacheKey);
  if (pending) return pending;
  const job = findCurated(aliases, series).then((card) => {
    if (card) curatedCache.set(cacheKey, card);
    curatedInflight.delete(cacheKey);
    return card;
  });
  curatedInflight.set(cacheKey, job);
  return job;
}

function sequelPenalty(extra: string) {
  if (!extra) return 0;
  if (/\b(2|3|4|5|6|ii|iii|iv|deux|retour|rises|reloaded|revolutions|legacy)\b/.test(extra)) return 80;
  if (/\b(1|communaute|malediction|begins)\b/.test(extra)) return 12;
  return 28;
}

async function findCurated(aliases: string[], series: boolean): Promise<WatchCard | null> {
  const wanted = aliases.map(foldName).filter(Boolean);
  let best: { item: WatchResult; score: number; season: number; penalty: number } | null = null;
  for (const alias of aliases) {
    try {
      const results = await searchTitles(alias);
      for (const item of results) {
        if (series ? item.kind !== "show" : item.kind !== "movie") continue;
        const left = foldName(item.title);
        if (!left) continue;
        let score = 0;
        for (const right of wanted) {
          if (left === right) score = Math.max(score, 100);
          else if (left.startsWith(`${right} `)) score = Math.max(score, 60);
        }
        if (!score) continue;
        const season = Number(item.title.match(/saison\s*(\d+)/i)?.[1] || 99);
        const extra = wanted.reduce((rest, right) => (left.startsWith(`${right} `) ? left.slice(right.length).trim() : rest), "");
        const penalty = sequelPenalty(extra);
        const better =
          !best ||
          score > best.score ||
          (score === best.score && penalty < best.penalty) ||
          (score === best.score && penalty === best.penalty && season < best.season) ||
          (score === best.score && penalty === best.penalty && season === best.season && item.title.length < best.item.title.length);
        if (better) best = { item, score, season, penalty };
      }
      if (best?.score === 100 && best.season <= 1) break;
    } catch {
      // next alias
    }
  }
  if (!best) return null;
  return {
    id: best.item.id,
    title: cleanDisplayTitle(best.item.title) || aliases[0],
    poster: best.item.poster,
    overview: "",
    backdrop: "",
    kind: series ? "show" : "movie",
  };
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

async function resolveGroups(groups: string[][], series: boolean) {
  const cards = await mapPool(groups, 6, (aliases) => resolveCurated(aliases, series));
  const seen = new Set<string>();
  const out: WatchCard[] = [];
  for (const card of cards) {
    if (!card?.id || !card.title || card.title === "null") continue;
    const key = titleKey(card.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(card);
  }
  return out;
}

async function withPresentation(card: WatchCard): Promise<WatchCard | null> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return card.poster ? { ...card, backdrop: card.poster } : null;
  const type = card.kind === "show" ? "tv" : "movie";
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/search/${type}?api_key=${key}&language=fr-FR&query=${encodeURIComponent(card.title)}`,
      { cache: "no-store" },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as {
      results?: { backdrop_path?: string | null; overview?: string }[];
    };
    const hit = data.results?.find((item) => item.backdrop_path);
    if (!hit?.backdrop_path) return null;
    return {
      ...card,
      backdrop: `https://image.tmdb.org/t/p/w1280${hit.backdrop_path}`,
      overview: (hit.overview || "").replace(/\s+/g, " ").trim(),
    };
  } catch {
    return null;
  }
}

let cachedSpotlight: { at: number; hero: WatchCard[] } | null = null;
let cachedRows: { at: number; rows: WatchHomeRow[] } | null = null;

export async function curatedSpotlight(): Promise<{ hero: WatchCard[] }> {
  if (cachedSpotlight && Date.now() - cachedSpotlight.at < 10 * 60 * 1000) return { hero: cachedSpotlight.hero };
  const found = await mapPool(HERO_PICKS, 4, (pick) => resolveCurated(pick.aliases, pick.series));
  const presented = await Promise.all(found.map((card) => (card ? withPresentation(card) : Promise.resolve(null))));
  let hero = presented.filter((card): card is WatchCard => Boolean(card?.backdrop && card.title));
  if (!hero.length) {
    hero = found.filter((card): card is WatchCard => Boolean(card?.poster)).map((card) => ({ ...card, backdrop: card.poster }));
  }
  hero = hero.slice(0, 8);
  if (hero.length >= 4) cachedSpotlight = { at: Date.now(), hero };
  return { hero };
}

export async function curatedRows(): Promise<WatchHomeRow[]> {
  if (cachedRows && Date.now() - cachedRows.at < 10 * 60 * 1000) return cachedRows.rows;
  const [series, films] = await Promise.all([
    resolveGroups(CURATED_SERIES, true),
    resolveGroups(CURATED_FILMS, false),
  ]);
  const filmKeys = new Set(films.map((item) => titleKey(item.title)));
  const rows = [
    {
      name: "Séries incontournables",
      items: series.filter((item) => !filmKeys.has(titleKey(item.title))),
      seeAll: "/selection/series",
    },
    {
      name: "Films incontournables",
      items: films,
      seeAll: "/selection/films",
    },
  ].filter((row) => row.items.length > 0);
  const filled = rows.reduce((sum, row) => sum + row.items.length, 0);
  if (filled >= 24) cachedRows = { at: Date.now(), rows };
  return rows;
}

function titleKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/\s*[-–:]?\s*saison\s*\d+.*/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function uniqueByTitle<T extends { title: string }>(items: T[]) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = titleKey(item.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function extractVersionBadge(block: string) {
  return decodeTitle(block.match(/film-version"><a[^>]*>([^<]+)/)?.[1] || "");
}

/** Keep VF / French / TrueFrench / VF+VOSTFR — drop VOSTFR-only and VO. */
function isFrenchVersionBadge(version: string) {
  const normalized = version.trim().toLowerCase();
  if (!normalized) return true;
  if (/^(vostfr|vost|vo|anglais|multi)$/i.test(normalized)) return false;
  if (/truefrench|^french$|french\b/i.test(normalized)) return true;
  if (normalized === "vf" || normalized.startsWith("vf+") || normalized.includes("+vf")) return true;
  if (normalized.includes("vf") && !normalized.startsWith("vost")) return true;
  return false;
}

function hasFrenchVersion(card: WatchCard & { version?: string }) {
  return isFrenchVersionBadge(card.version || "");
}

async function withBackdrop(card: WatchCard): Promise<WatchCard> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return card;
  const type = card.kind === "show" ? "tv" : "movie";
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/search/${type}?api_key=${key}&language=fr-FR&query=${encodeURIComponent(card.title)}`,
      { cache: "no-store" },
    );
    if (!response.ok) return card;
    const data = (await response.json()) as { results?: { backdrop_path?: string | null }[] };
    const path = data.results?.find((item) => item.backdrop_path)?.backdrop_path;
    if (!path) return card;
    return { ...card, backdrop: `https://image.tmdb.org/t/p/w1280${path}` };
  } catch {
    return card;
  }
}

export type WatchSeason = { id: string; title: string };
export type WatchEpisode = { number: number; title: string };
export type WatchPerson = { id: string; name: string; image: string };
export type WatchGenre = { id: string; name: string };

export type WatchTitle = WatchCard & {
  seasons: WatchSeason[];
  episodes: WatchEpisode[];
  cast: WatchPerson[];
  genres: WatchGenre[];
  directors: string[];
  year: string;
  runtime: string;
  quality: string;
};

export async function listCatalog(kind: WatchResult["kind"], page = 1) {
  const origin = await catalogOrigin();
  const safePage = Math.max(1, Math.min(40, Math.floor(page) || 1));
  const path =
    kind === "movie"
      ? safePage === 1
        ? "/films/vf/"
        : `/films/vf/page/${safePage}/`
      : safePage === 1
        ? "/s-tv/s-vf/"
        : `/s-tv/s-vf/page/${safePage}/`;
  const response = await fetch(`${origin}${path}`, { headers: headers(origin), cache: "no-store" });
  if (!response.ok) throw new Error("Catalogue indisponible");
  const items = parseListing(await response.text(), kind).filter(hasFrenchVersion);
  return { items, page: safePage, hasMore: items.length >= 12 };
}

const CATALOG_GENRES: { id: string; name: string; films: string; series: string }[] = [
  { id: "action", name: "Action", films: "/films/actions/", series: "/action-serie-/" },
  { id: "animation", name: "Animation", films: "/films/animations/", series: "/animation-serie-/" },
  { id: "aventure", name: "Aventure", films: "/films/aventures/", series: "/aventure-series-/" },
  { id: "comedie", name: "Comédie", films: "/films/comedies/", series: "/comedie-serie-/" },
  { id: "crime", name: "Crime", films: "/films/policiers/", series: "/policier-series-/" },
  { id: "documentaire", name: "Documentaire", films: "/films/documentaires/", series: "/documentaire-serie-/" },
  { id: "drame", name: "Drame", films: "/films/drames/", series: "/drame-serie-/" },
  { id: "fantastique", name: "Fantastique", films: "/films/fantastiques/", series: "/fantastique-series-/" },
  { id: "guerre", name: "Guerre", films: "/films/guerres/", series: "" },
  { id: "historique", name: "Historique", films: "/films/historiques/", series: "/serie-historiques-/" },
  { id: "horreur", name: "Horreur", films: "/films/epouvante-horreurs/", series: "/horreur-serie-/" },
  { id: "romance", name: "Romance", films: "/films/romances/", series: "/romance-series-/" },
  { id: "science-fiction", name: "Science-fiction", films: "/films/science-fictions/", series: "/science-fiction-series-/" },
  { id: "thriller", name: "Thriller", films: "/films/thrillers/", series: "/thriller-series-/" },
  { id: "western", name: "Western", films: "/films/westerns/", series: "/western-series-/" },
];

export async function listGenres(): Promise<WatchGenre[]> {
  return CATALOG_GENRES.map(({ id, name }) => ({ id, name }));
}

async function loadGenreSide(origin: string, path: string, page: number, kind: WatchResult["kind"]) {
  if (!path) return [] as WatchCard[];
  const safePage = Math.max(1, Math.min(40, Math.floor(page) || 1));
  const url = safePage === 1 ? `${origin}${path}` : `${origin}${path.replace(/\/$/, "")}/page/${safePage}/`;
  const response = await fetch(url, { headers: headers(origin), cache: "no-store" });
  if (!response.ok) return [];
  return uniqueByTitle(parseListing(await response.text(), kind).filter(hasFrenchVersion));
}

export async function genreCatalog(genreId: string, page = 1, kind: "all" | "movie" | "show" = "all") {
  const id = genreId.trim().replace(/^\/+|\/+$/g, "");
  const genre = CATALOG_GENRES.find((item) => item.id === id);
  if (!genre) throw new Error("Genre introuvable");
  const origin = await catalogOrigin();
  const safePage = Math.max(1, Math.min(40, Math.floor(page) || 1));
  const [movies, shows] = await Promise.all([
    kind === "show" ? Promise.resolve([] as WatchCard[]) : loadGenreSide(origin, genre.films, safePage, "movie"),
    kind === "movie" ? Promise.resolve([] as WatchCard[]) : loadGenreSide(origin, genre.series, safePage, "show"),
  ]);
  return {
    id,
    name: genre.name,
    movies,
    shows,
    page: safePage,
    movieHasMore: movies.length >= 12,
    showHasMore: shows.length >= 12,
  };
}

export async function freshCatalog(): Promise<WatchHomeRow[]> {
  const [films, series] = await Promise.all([listCatalog("movie", 1), listCatalog("show", 1)]);
  return [
    { name: "Nouveautés films", items: uniqueByTitle(films.items).slice(0, 16), seeAll: "/films" },
    { name: "Nouveautés séries", items: uniqueByTitle(series.items).slice(0, 16), seeAll: "/series" },
  ].filter((row) => row.items.length > 0);
}

type AnimeBlocks = {
  vf?: Record<string, Record<string, string>>;
  vostfr?: Record<string, Record<string, string>>;
  vo?: Record<string, Record<string, string>>;
  info?: Record<string, { title?: string; synopsis?: string; poster?: string }>;
};

async function mangaBlocks(id: string): Promise<AnimeBlocks> {
  const response = await fetch(
    `${MANGA_ORIGIN}/engine/ajax/manga_episodes_api.php?id=${encodeURIComponent(id)}`,
    { headers: mangaHeaders(), cache: "no-store", signal: AbortSignal.timeout(12000) },
  );
  if (!response.ok) throw new Error("Animé introuvable");
  const text = (await response.text()).replace(/^\uFEFF/, "");
  return JSON.parse(text) as AnimeBlocks;
}

function episodeNumbers(data: AnimeBlocks) {
  return [
    ...new Set([
      ...Object.keys(data.vf || {}),
      ...Object.keys(data.vostfr || {}),
      ...Object.keys(data.vo || {}),
    ]),
  ]
    .map((key) => Number(key))
    .filter((number) => Number.isInteger(number) && number > 0)
    .sort((a, b) => a - b);
}

function episodeList(data: AnimeBlocks) {
  return episodeNumbers(data).map((number) => ({
    number,
    title: data.info?.[String(number)]?.title?.replace(/\\'/g, "'") || `Épisode ${number}`,
  }));
}

async function playManga(id: string, episode: number | undefined, options: PlayOptions = {}) {
  const data = await mangaBlocks(id);
  const numbers = episodeNumbers(data);
  const picked = episode && numbers.includes(episode) ? episode : numbers[0];
  if (!picked) throw new Error("Lecture indisponible pour cet animé");
  const key = String(picked);
  const servers = listEpisodeServers(data.vf?.[key], data.vostfr?.[key], data.vo?.[key]);
  return playFromServers(servers, MANGA_ORIGIN, options);
}

async function mangaTitle(id: string, kind: WatchResult["kind"]): Promise<WatchTitle> {
  const full = `m-${id}`;
  const [page, data] = await Promise.all([
    fetch(`${MANGA_ORIGIN}/index.php?newsid=${encodeURIComponent(id)}`, {
      headers: mangaHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    }).then((response) => (response.ok ? response.text() : "")),
    mangaBlocks(id),
  ]);
  const title =
    decodeTitle(page.match(/property="og:title" content="([^"]*)"/)?.[1] || "") ||
    decodeTitle(page.match(/<h1[^>]*>([^<]+)/)?.[1] || "") ||
    "Animé";
  const poster =
    page.match(/https:\/\/image\.tmdb\.org\/t\/p\/[^"'\s]+/)?.[0] ||
    data.info?.["1"]?.poster ||
    "";
  const overview = data.info?.["1"]?.synopsis || "";
  const episodes = episodeList(data);
  const seasonTitle = title.match(/saison\s*\d+/i)?.[0] || "Saison";
  const card = await withBackdrop({
    id: full,
    title,
    poster,
    overview,
    backdrop: poster,
    kind,
  });
  return {
    ...card,
    seasons: [{ id: full, title: seasonTitle }],
    episodes: kind === "show" ? episodes : [],
    cast: [],
    genres: [],
    directors: [],
    year: "",
    runtime: "",
    quality: "",
  };
}

function parseAnimeLines(html: string) {
  const block = html.match(/class="eps"[^>]*>([\s\S]*?)<\/div>/)?.[1] || "";
  const episodes: { number: number; urls: string[] }[] = [];
  for (const line of block.trim().split(/\s+/)) {
    const split = line.indexOf("!");
    if (split < 1) continue;
    const number = Number(line.slice(0, split));
    const urls = line
      .slice(split + 1)
      .split(",")
      .map((url) => url.trim())
      .filter((url) => url.startsWith("http"));
    if (Number.isInteger(number) && number > 0 && urls.length) episodes.push({ number, urls });
  }
  return episodes.sort((a, b) => a.number - b.number);
}

async function animePage(key: string) {
  const path = key.replace(/__/g, "/");
  const response = await fetch(`${ANIME_ORIGIN}/${path}.html`, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: `${ANIME_ORIGIN}/`,
      "Accept-Language": "fr-FR,fr;q=0.9",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("Animé introuvable");
  return response.text();
}

async function playAnimeSite(key: string, episode: number | undefined, options: PlayOptions = {}) {
  const episodes = parseAnimeLines(await animePage(key));
  const picked = episodes.find((item) => item.number === episode) || (!episode ? episodes[0] : undefined);
  if (!picked) throw new Error("Épisode introuvable");
  const raw = picked.urls.map((src, index) => ({
    id: `fa${index}`,
    src,
    version: "vf" as const,
    host: "anime",
  }));
  return playFromServers(sortServers(assignVersionLabels(raw)), ANIME_ORIGIN, options);
}

async function animeSiteTitle(key: string, kind: WatchResult["kind"]): Promise<WatchTitle> {
  const full = `a-${key}`;
  const html = await animePage(key);
  const title =
    decodeTitle(html.match(/property="og:title" content="([^"]*)"/)?.[1] || "") ||
    decodeTitle(html.match(/<h1[^>]*>([^<]+)/)?.[1] || "") ||
    "Animé";
  const episodes = parseAnimeLines(html).map((item) => ({
    number: item.number,
    title: `Épisode ${item.number}`,
  }));
  const card = await withBackdrop({
    id: full,
    title,
    poster: "",
    overview: "",
    backdrop: "",
    kind,
  });
  return {
    ...card,
    seasons: [{ id: full, title: "Saison" }],
    episodes: kind === "show" ? episodes : [],
    cast: [],
    genres: [],
    directors: [],
    year: "",
    runtime: "",
    quality: "",
  };
}

export async function titleCatalog(id: string, kind: WatchResult["kind"]): Promise<WatchTitle> {
  if (id.startsWith("en-")) {
    const { englishTitle } = await import("./english");
    return englishTitle(id, kind);
  }
  if (id.startsWith("m-")) return mangaTitle(id.slice(2), kind);
  if (id.startsWith("a-")) return animeSiteTitle(id.slice(2), kind);
  const origin = await catalogOrigin();
  const film = await filmData(origin, id);
  let title = "";
  let overview = "";
  let poster = film.meta?.affiche || "";
  let banner = film.meta?.affiche2 || "";
  let cast: WatchPerson[] = [];
  let genres: WatchGenre[] = [];
  let directors: string[] = [];
  let year = "";
  let runtime = "";
  let quality = "";
  try {
    const page = await fetch(`${origin}/index.php?newsid=${encodeURIComponent(id)}`, {
      headers: headers(origin),
      cache: "no-store",
    });
    const html = await page.text();
    title = decodeTitle(html.match(/property="og:title" content="([^"]*)"/)?.[1] || "");
    const raw =
      html.match(/id="s-desc"[^>]*>([\s\S]*?)<\/div>/)?.[1] ||
      html.match(/id="desc-\d+"[^>]*>([\s\S]*?)<\/span>/)?.[1] ||
      "";
    overview = decodeTitle(
      raw
        .replace(/<p class="desc-text"[^>]*>[\s\S]*?<\/p>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " "),
    );
    if (!poster) poster = html.match(/property="og:image" content="([^"]*)"/)?.[1] || "";
    cast = extractActors(html);
    genres = extractGenres(html);
    directors = extractDirectors(html);
    year = stripHtml(
      html.match(/class="release_date"[^>]*>[\s\S]*?<\/span>/)?.[0] || "",
    )
      .replace(/^.*?-\s*/, "")
      .trim();
    runtime = stripHtml(html.match(/class="runtime"[^>]*>([\s\S]*?)<\/span>/)?.[1] || "")
      .replace(/\s+/g, " ")
      .trim();
    // Keep only the label (HD, 4K…), never the xfsearch <a href=...> junk.
    quality = stripHtml(
      html.match(/id="film_quality"[^>]*>([\s\S]*?)<\/span>/)?.[1] ||
        html.match(/class="film-quality"[^>]*>([\s\S]*?)<\/span>/)?.[1] ||
        "",
    )
      .replace(/\s+/g, " ")
      .trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9 .+-]{0,12}$/.test(quality)) quality = "";
  } catch {
    title = title || "Titre";
  }
  const card = await withBackdrop({
    id,
    title: title || "Titre",
    poster,
    overview,
    backdrop: banner || poster,
    kind,
  });
  if (kind === "movie") {
    return {
      ...card,
      seasons: [],
      episodes: [],
      cast,
      genres,
      directors,
      year,
      runtime,
      quality,
    };
  }
  const show = await showCatalog(id);
  return {
    ...card,
    poster: card.poster || show.poster,
    seasons: show.seasons,
    episodes: show.episodes,
    cast,
    genres,
    directors,
    year,
    runtime,
    quality,
  };
}

export async function peopleCatalog(id: string, page = 1, signal?: AbortSignal) {
  const origin = await catalogOrigin();
  const safePage = Math.max(1, Math.min(40, Math.floor(page) || 1));
  const slug = id.trim().replace(/\s+/g, "+");
  if (!slug) throw new Error("Acteur introuvable");
  const path = `/xfsearch/actors/${encodeURIComponent(slug).replace(/%2B/gi, "+")}/page/${safePage}`;
  const response = await fetch(`${origin}${path}`, { headers: headers(origin), cache: "no-store", signal });
  if (response.status === 404) {
    return {
      id: slug,
      name: decodeTitle(slug.replace(/\+/g, " ")),
      items: [] as WatchCard[],
      page: safePage,
      hasMore: false,
    };
  }
  if (!response.ok) throw new Error("Acteur introuvable");
  const html = await response.text();
  const name =
    decodeTitle(html.match(/property="og:title" content="([^"]*)"/)?.[1] || "") ||
    decodeTitle(slug.replace(/\+/g, " "));
  const items = parseListing(html, "movie").map((item) => {
    // parseListing forces movie; re-detect show from title/id
    const show =
      /saison/i.test(item.title) ||
      item.id.includes("-saison-") ||
      item.id.includes("s-tv");
    return { ...item, kind: (show ? "show" : "movie") as WatchResult["kind"] };
  });
  return {
    id: slug,
    name: name.replace(/^Films? avec\s+/i, "").trim() || decodeTitle(slug.replace(/\+/g, " ")),
    items,
    page: safePage,
    hasMore: items.length >= 16,
  };
}

export async function searchCatalog(query: string): Promise<{
  results: WatchResult[];
  people: { id: string; name: string; count: number }[];
}> {
  const started = Date.now();
  const results = (
    await deadline(8000, (signal) => searchTitlesNow(query, signal, 2), [])
  ).map((item) => ({ ...item, source: "FrenchStream" }));

  const left = Math.max(0, 8000 - (Date.now() - started));
  const people =
    left >= 400
      ? await deadline(Math.min(1500, left), (signal) => lookupPeople(query, signal), [])
      : [];

  return { results, people };
}

async function lookupPeople(query: string, signal: AbortSignal) {
  try {
    const actor = await peopleCatalog(query, 1, signal);
    if (!actor.items.length) return [];
    return [{ id: actor.id, name: actor.name, count: actor.items.length }];
  } catch {
    return [];
  }
}

export async function findPlayable(query: string): Promise<WatchResult | null> {
  const wanted = foldName(query);
  if (!wanted) return null;
  const results = await deadline(8000, (signal) => searchTitlesNow(query, signal, 2), []);
  let best: { item: WatchResult; score: number } | null = null;
  for (const item of results) {
    const left = foldName(item.title);
    if (!left) continue;
    const score = left === wanted ? 100 : left.startsWith(`${wanted} `) ? 60 : 0;
    if (!score) continue;
    if (!best || score > best.score || (score === best.score && item.title.length < best.item.title.length)) {
      best = { item, score };
    }
  }
  return best ? { ...best.item, source: "FrenchStream" } : null;
}

export async function searchAnimeCatalog(query: string): Promise<WatchResult[]> {
  const manga = await deadline(8000, (signal) => searchManga(query, signal), []);
  const seen = new Set(manga.map((item) => titleKey(item.title)));
  const extra = await deadline(8000, (signal) => searchAnimeSite(query, signal), []);
  return [...manga, ...extra.filter((item) => !seen.has(titleKey(item.title)))].map((item) => ({
    id: item.id,
    title: item.title,
    poster: item.poster,
    kind: item.kind,
  }));
}

async function searchManga(query: string, signal?: AbortSignal): Promise<WatchResult[]> {
  try {
    const origin = "https://w16.french-manga.net";
    const response = await fetch(`${origin}/engine/ajax/search.php`, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: `${origin}/`,
        Cookie: "dle_skin=MGM",
      },
      body: new URLSearchParams({ query, page: "1" }),
      cache: "no-store",
      signal,
    });
    if (!response.ok) return [];
    const html = await response.text();
    const results: WatchResult[] = [];
    for (const block of html.split(/class="search-item"/).slice(1)) {
      const onclick = block.match(/onclick="[^"]*\/([^'"]+)/)?.[1] || "";
      const title = decodeTitle(block.match(/class="search-title"[^>]*>([^<]+)/)?.[1] || "").replace(/\\'/g, "'");
      const poster = absUrl(origin, block.match(/<img[^>]+src="([^"]+)"/)?.[1] || "");
      const id = onclick.split("/").filter(Boolean).pop()?.split("?")[0] || "";
      if (!title || !id) continue;
      const show = /saison|intégrale|integrale/i.test(title);
      results.push({ id: `m-${id}`, title, poster, kind: show ? "show" : "movie" });
    }
    return uniqueByTitle(results);
  } catch {
    return [];
  }
}

async function searchAnimeSite(query: string, signal?: AbortSignal): Promise<WatchResult[]> {
  try {
    const origin = "https://french-anime.com";
    const response = await fetch(`${origin}/`, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: `${origin}/`,
      },
      body: new URLSearchParams({
        do: "search",
        subaction: "search",
        story: query,
        search_start: "0",
        full_search: "0",
      }),
      cache: "no-store",
      signal,
    });
    if (!response.ok) return [];
    const html = await response.text();
    const results: WatchResult[] = [];
    for (const match of html.matchAll(/<a class="mov-t"[^>]*href="([^"]+)"[^>]*>([^<]+)/g)) {
      const title = decodeTitle(match[2]);
      const id = animeWatchId(match[1]);
      if (!title || !id) continue;
      results.push({ id, title, poster: "", kind: /film/i.test(match[1]) ? "movie" : "show" });
    }
    return uniqueByTitle(results);
  } catch {
    return [];
  }
}

export async function searchMore(query: string): Promise<WatchResult[]> {
  const [frembed, wiflix] = await Promise.all([
    deadline(6000, (signal) => searchFrembed(query, signal), []),
    deadline(6000, (signal) => searchWiflix(query, signal), []),
  ]);
  return uniqueByTitle([...wiflix, ...frembed]).slice(0, 24);
}

async function searchFrembed(query: string, signal?: AbortSignal): Promise<WatchResult[]> {
  try {
    const response = await fetch(
      `https://frembed.casa/api/public/search?page=1&query=${encodeURIComponent(query)}`,
      { headers: { "User-Agent": "Mozilla" }, cache: "no-store", signal },
    );
    if (!response.ok) return [];
    const data = (await response.json()) as {
      movies?: { title_fr?: string; title?: string; poster?: string; media_type?: string }[];
      tvShows?: { title_fr?: string; title?: string; name?: string; poster?: string; poster_path?: string }[];
      series?: { title_fr?: string; title?: string; name?: string; poster?: string; poster_path?: string }[];
    };
    const movies = (data.movies || []).map((item) => toExternal(item.title_fr || item.title || "", item.poster || "", "movie", "Frembed"));
    const shows = [...(data.tvShows || []), ...(data.series || [])].map((item) =>
      toExternal(item.title_fr || item.title || item.name || "", item.poster || item.poster_path || "", "show", "Frembed"),
    );
    return [...movies, ...shows].filter((item) => item.title);
  } catch {
    return [];
  }
}

async function searchWiflix(query: string, signal?: AbortSignal): Promise<WatchResult[]> {
  try {
    const origin = "https://flemmix.style";
    const response = await fetch(`${origin}/index.php?do=search`, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: `${origin}/`,
      },
      body: new URLSearchParams({
        story: query,
        do: "search",
        subaction: "search",
        search_start: "1",
        full_search: "0",
      }),
      cache: "no-store",
      signal,
    });
    if (!response.ok) return [];
    const html = await response.text();
    if (/bot shield|acces securise/i.test(html) || !html.includes("mov-t")) return [];
    const results: WatchResult[] = [];
    for (const match of html.matchAll(/<a class="mov-t"[^>]*href="([^"]+)"[^>]*>([^<]+)/g)) {
      const href = match[1];
      const title = decodeTitle(match[2]);
      if (!title) continue;
      const show = /serie/i.test(href);
      results.push({ id: "", title, poster: "", kind: show ? "show" : "movie", source: "Wiflix" });
    }
    return results;
  } catch {
    return [];
  }
}

function toExternal(title: string, poster: string, kind: WatchResult["kind"], source: string): WatchResult {
  const art = poster.startsWith("http")
    ? poster
    : poster.startsWith("/")
      ? `https://image.tmdb.org/t/p/w342${poster}`
      : "";
  return { id: "", title: title.trim(), poster: art, kind, source };
}

export async function showCatalog(id: string) {
  if (id.startsWith("en-")) {
    const { englishShow } = await import("./english");
    return englishShow(id);
  }
  if (id.startsWith("m-")) {
    const data = await mangaBlocks(id.slice(2));
    return { poster: data.info?.["1"]?.poster || "", seasons: [{ id, title: "Saison" }], episodes: episodeList(data) };
  }
  if (id.startsWith("a-")) {
    const episodes = parseAnimeLines(await animePage(id.slice(2))).map((item) => ({
      number: item.number,
      title: `Épisode ${item.number}`,
    }));
    return { poster: "", seasons: [{ id, title: "Saison" }], episodes };
  }
  const origin = await catalogOrigin();
  const film = await filmData(origin, id);
  const tag = film.meta?.tagz || "";
  const seasons = await seasonsFor(origin, tag, id);
  const episodes = await episodesFor(origin, id);
  return {
    poster: film.meta?.affiche || "",
    seasons,
    episodes,
  };
}

function parseListing(html: string, kind: WatchResult["kind"]): Array<WatchCard & { version?: string }> {
  const section = html.match(/id="dle-content"[\s\S]*$/i)?.[0] || html;
  const items: Array<WatchCard & { version?: string }> = [];
  for (const block of section.split(/class="short"/).slice(1)) {
    const title = decodeTitle(block.match(/class="short-title">([^<]+)/)?.[1] || "");
    const poster = block.match(/<img[^>]+src="([^"]+)"/)?.[1] || "";
    const modalId = block.match(/openModal\('(\d+)'\)/)?.[1] || "";
    const newsId = block.match(/newsid=(\d+)/)?.[1] || "";
    const posterHref =
      block.match(/class="[^"]*short-poster[^"]*"[^>]*href="([^"]+)"/)?.[1] ||
      block.match(/href="([^"]+)"[^>]*class="[^"]*short-poster[^"]*"/)?.[1] ||
      "";
    const slug = posterHref.split("/").filter(Boolean).pop()?.split("?")[0] || "";
    const id = modalId || newsId || (/^\d+/.test(slug) ? slug : "") || "";
    if (!id || !title || id === "index.php") continue;
    const version = extractVersionBadge(block);
    if (!isFrenchVersionBadge(version)) continue;
    const looksSeries =
      /saison/i.test(title) ||
      posterHref.includes("-saison-") ||
      posterHref.includes("/s-tv/");
    if (kind === "movie" && looksSeries) continue;
    if (kind === "show" && !looksSeries) continue;
    items.push({
      id,
      title,
      poster,
      overview: "",
      backdrop: poster,
      kind: looksSeries ? "show" : "movie",
      version,
    });
  }
  return items;
}

function extractActors(html: string): WatchPerson[] {
  const content = html.match(/actorData\s*=\s*\[([\s\S]*?)];/)?.[1];
  if (!content) return [];
  const people: WatchPerson[] = [];
  const seen = new Set<string>();
  for (const match of content.matchAll(/"(.+?)\s*\(.*?\)\s*-\s*([^"]+)"/g)) {
    const name = decodeTitle(match[1]).trim();
    const image = match[2].trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    people.push({
      id: name.replace(/\s+/g, "+"),
      name,
      image,
    });
  }
  return people;
}

function extractGenres(html: string): WatchGenre[] {
  const block = html.match(/class="genres"[^>]*>([\s\S]*?)<\/span>/)?.[1] || "";
  const genres: WatchGenre[] = [];
  for (const match of block.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g)) {
    const href = match[1];
    const name = decodeTitle(match[2]);
    const id = href.replace(/\/+$/, "").split("/").pop() || name;
    if (!name) continue;
    genres.push({ id, name });
  }
  return genres;
}

function extractDirectors(html: string): string[] {
  const items = [...html.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((match) => match[1]);
  const row = items.find((item) => /alisateur/i.test(item)) || "";
  return [...row.matchAll(/<a[^>]*>([^<]+)<\/a>/g)].map((match) => decodeTitle(match[1])).filter(Boolean);
}

export type WatchVersion = "vf" | "vo" | "vostfr";

export type WatchServer = {
  id: string;
  src: string;
  version: WatchVersion;
  label: string;
  host: string;
};

export type WatchServerOption = {
  id: string;
  label: string;
  version: WatchVersion;
};

export type WatchPlayResult = {
  stream: string;
  server: string;
  servers: WatchServerOption[];
  language: "fr" | "en" | "unknown";
  version: WatchVersion;
};

export class EnglishChoiceNeededError extends Error {
  servers: WatchServerOption[];
  constructor(servers: WatchServerOption[]) {
    super("VF_UNAVAILABLE_ASK_ENGLISH");
    this.name = "EnglishChoiceNeededError";
    this.servers = servers;
  }
}

type PlayOptions = {
  preferredServer?: string;
  allowEnglish?: boolean;
};

/** Resolve a playable stream: prefer confirmed VF, otherwise ask before English. */
export async function resolvePlaylist(id: string, options: PlayOptions = {}): Promise<WatchPlayResult> {
  if (id.startsWith("en-")) {
    const { englishPlay } = await import("./english");
    return englishPlay(id, undefined, options.preferredServer);
  }
  if (id.startsWith("m-")) return playManga(id.slice(2), undefined, options);
  if (id.startsWith("a-")) return playAnimeSite(id.slice(2), undefined, options);
  const origin = await catalogOrigin();
  const film = await filmData(origin, id);
  const servers = listMovieServers(film.players || {});
  return playFromServers(servers, origin, options);
}

/** @deprecated alias kept for older imports */
export async function vidzyPlaylist(id: string, preferredServer?: string) {
  const result = await resolvePlaylist(id, { preferredServer });
  return result.stream;
}

export async function resolveEpisode(
  seasonId: string,
  episode: number,
  options: PlayOptions = {},
): Promise<WatchPlayResult> {
  if (seasonId.startsWith("en-")) {
    const { englishPlay } = await import("./english");
    return englishPlay(seasonId, episode, options.preferredServer);
  }
  if (seasonId.startsWith("m-")) return playManga(seasonId.slice(2), episode, options);
  if (seasonId.startsWith("a-")) return playAnimeSite(seasonId.slice(2), episode, options);
  const origin = await catalogOrigin();
  const response = await fetch(`${origin}/engine/ajax/sx.php?id=${encodeURIComponent(seasonId)}`, {
    headers: headers(origin),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Épisode introuvable");
  const data = (await response.json()) as {
    vf?: Record<string, Record<string, string>>;
    vostfr?: Record<string, Record<string, string>>;
    vo?: Record<string, Record<string, string>>;
  };
  const key = String(episode);
  const servers = listEpisodeServers(data.vf?.[key], data.vostfr?.[key], data.vo?.[key]);
  return playFromServers(servers, origin, options);
}

/** @deprecated alias kept for older imports */
export async function vidzyEpisode(seasonId: string, episode: number, preferredServer?: string) {
  const result = await resolveEpisode(seasonId, episode, { preferredServer });
  return result.stream;
}

async function filmData(origin: string, id: string) {
  const response = await fetch(`${origin}/engine/ajax/film_api.php?id=${encodeURIComponent(id)}`, {
    headers: headers(origin),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Fiche introuvable");
  return (await response.json()) as {
    players?: Record<string, Record<string, string>>;
    meta?: { affiche?: string; affiche2?: string; tagz?: string; trailer?: string };
  };
}

async function seasonsFor(origin: string, tag: string, id: string): Promise<WatchSeason[]> {
  if (!tag) return [{ id, title: "Saison" }];
  const response = await fetch(`${origin}/engine/ajax/get_seasons.php`, {
    method: "POST",
    headers: {
      ...headers(origin),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ serie_tag: tag }),
    cache: "no-store",
  });
  if (!response.ok) return [{ id, title: "Saison" }];
  const rows = (await response.json()) as { id?: number | string; title?: string }[];
  const seasons = rows
    .map((row) => ({
      id: String(row.id || ""),
      title: row.title || "Saison",
    }))
    .filter((row) => row.id);
  return seasons.length ? seasons : [{ id, title: "Saison" }];
}

async function episodesFor(origin: string, id: string): Promise<WatchEpisode[]> {
  const response = await fetch(`${origin}/engine/ajax/sx.php?id=${encodeURIComponent(id)}`, {
    headers: headers(origin),
    cache: "no-store",
  });
  if (!response.ok) return [];
  const data = (await response.json()) as {
    vf?: Record<string, unknown>;
    vostfr?: Record<string, unknown>;
    vo?: Record<string, unknown>;
    info?: Record<string, { title?: string }>;
  };
  // Uniquement les épisodes dispo en VF
  const numbers = new Set(Object.keys(data.vf || {}));
  return [...numbers]
    .map((key) => Number(key))
    .filter((number) => Number.isInteger(number) && number > 0)
    .sort((a, b) => a - b)
    .map((number) => ({
      number,
      title: data.info?.[String(number)]?.title?.replace(/\\'/g, "'") || `Épisode ${number}`,
    }));
}

function versionFromKey(key: string): WatchVersion | null {
  const normalized = key.trim().toLowerCase();
  if (normalized === "vostfr" || normalized === "vost") return "vostfr";
  if (normalized === "vo" || normalized === "anglais" || normalized === "en" || normalized === "eng") return "vo";
  if (isFrenchAudioKey(normalized)) return "vf";
  if (normalized === "default") return "vf"; // provisional — refined at play time
  return null;
}

function ignoreSource(source: string, href: string) {
  if (source.trim().toLowerCase() === "dood.stream" && href.includes("/bigwar5/")) return true;
  return false;
}

function isDirectMedia(url: string) {
  return /\.(m3u8|mp4|mkv|webm)(\?|$)/i.test(url) || url.includes(".m3u8");
}

function publicServerOptions(servers: WatchServer[]): WatchServerOption[] {
  return servers.map(({ id, label, version }) => ({ id, label, version }));
}

function assignVersionLabels(servers: Array<Omit<WatchServer, "label">>): WatchServer[] {
  const counts: Record<WatchVersion, number> = { vf: 0, vo: 0, vostfr: 0 };
  return servers.map((server) => {
    counts[server.version] += 1;
    const n = counts[server.version];
    const base = server.version === "vf" ? "VF" : server.version === "vostfr" ? "VOSTFR" : "VO";
    return { ...server, label: n === 1 ? base : `${base} ${n}` };
  });
}

/** Build VF + VO/VOSTFR servers from film_api (labels only, no hostnames in UI). */
function listMovieServers(players: Record<string, Record<string, string>>): WatchServer[] {
  const raw: Array<Omit<WatchServer, "label">> = [];
  const seen = new Set<string>();
  let index = 0;

  for (const [provider, langMap] of Object.entries(players)) {
    const keys = Object.keys(langMap).map((key) => key.toLowerCase());
    const hasForeignSibling = keys.some((key) => key === "vostfr" || key === "vost" || key === "vo");

    const entries = Object.entries(langMap)
      .map(([key, url]) => ({ key, url, version: versionFromKey(key) }))
      .filter((entry): entry is { key: string; url: string; version: WatchVersion } => !!entry.version);

    // Prefer explicit VF keys over ambiguous default when both exist.
    const explicitFrench = entries.filter((entry) => entry.key.toLowerCase() !== "default" && entry.version === "vf");
    const foreign = entries.filter((entry) => entry.version === "vo" || entry.version === "vostfr");
    const defaults = entries.filter((entry) => entry.key.toLowerCase() === "default");

    const chosen: Array<{ url: string; version: WatchVersion }> = [];
    for (const entry of explicitFrench) chosen.push(entry);
    for (const entry of foreign) chosen.push(entry);
    if (!explicitFrench.length) {
      for (const entry of defaults) {
        // If VO/VOSTFR siblings exist, default is often the same as VF — still OK as VF.
        // If default equals a vostfr URL, skip.
        const isForeignUrl = foreign.some((item) => item.url === entry.url);
        if (isForeignUrl) continue;
        chosen.push({ url: entry.url, version: hasForeignSibling ? "vf" : "vf" });
      }
    }

    for (const entry of chosen) {
      if (!entry.url?.startsWith("http") || ignoreSource(provider, entry.url) || seen.has(entry.url)) continue;
      seen.add(entry.url);
      raw.push({
        id: `vid${index++}`,
        src: entry.url,
        version: entry.version,
        host: provider.toLowerCase(),
      });
    }
  }

  return sortServers(assignVersionLabels(raw));
}

/** Episodes: VF map + optional VOSTFR/VO maps for version picker. */
function listEpisodeServers(
  vfBlock: Record<string, string> | undefined,
  vostfrBlock?: Record<string, string>,
  voBlock?: Record<string, string>,
): WatchServer[] {
  const raw: Array<Omit<WatchServer, "label">> = [];
  const seen = new Set<string>();
  let index = 0;

  const push = (block: Record<string, string> | undefined, version: WatchVersion) => {
    if (!block) return;
    for (const [provider, url] of Object.entries(block)) {
      if (!url?.startsWith("http") || ignoreSource(provider, url) || seen.has(url)) continue;
      seen.add(url);
      raw.push({
        id: `ep${index++}`,
        src: url,
        version,
        host: provider.toLowerCase(),
      });
    }
  };

  push(vfBlock, "vf");
  push(vostfrBlock, "vostfr");
  push(voBlock, "vo");
  return sortServers(assignVersionLabels(raw));
}

function sortServers(servers: WatchServer[]) {
  const versionScore = (version: WatchVersion) => (version === "vf" ? 0 : version === "vostfr" ? 1 : 2);
  const hostScore = (host: string) => {
    if (host.includes("premium") || host.includes("fsvid")) return 0;
    if (host.includes("uqload")) return 1;
    if (host.includes("vidoza")) return 2;
    if (host.includes("filemoon") || host.includes("filmoon") || host.includes("streamwish")) return 3;
    if (host.includes("vidzy")) return 8;
    if (host.includes("dood") || host.includes("voe")) return 9;
    return 5;
  };
  return servers
    .map((server, index) => ({ server, index }))
    .sort((a, b) => {
      const byVersion = versionScore(a.server.version) - versionScore(b.server.version);
      if (byVersion !== 0) return byVersion;
      const byHost = hostScore(a.server.host) - hostScore(b.server.host);
      return byHost !== 0 ? byHost : a.index - b.index;
    })
    .map(({ server }) => server);
}

async function playFromServers(
  servers: WatchServer[],
  origin: string,
  options: PlayOptions = {},
): Promise<WatchPlayResult> {
  if (!servers.length) {
    throw new Error("Version française (VF) indisponible pour ce titre");
  }

  const preferredServer = options.preferredServer;
  const allowEnglish = options.allowEnglish === true;
  const catalog = publicServerOptions(servers);
  const preferred = preferredServer ? servers.find((server) => server.id === preferredServer) : undefined;

  const tryOrder = preferred
    ? [preferred, ...servers.filter((server) => server.id !== preferred.id)]
    : [
        ...servers.filter((server) => server.version === "vf"),
        ...(allowEnglish ? servers.filter((server) => server.version !== "vf") : []),
      ];

  const english: WatchPlayResult[] = [];
  const errors: string[] = [];

  for (const server of tryOrder) {
    // Manual VO pick is always allowed; autoplay stays VF-only unless allowEnglish.
    if (!preferred && server.version !== "vf" && !allowEnglish) continue;
    try {
      const stream = await openEmbed(server.src, origin);
      if (!stream) {
        errors.push(`source-${server.id}`);
        continue;
      }
      const language = await classifyStreamLanguage(stream);
      const result: WatchPlayResult = {
        stream,
        server: server.id,
        servers: catalog,
        language,
        version: server.version,
      };

      // User picked this server explicitly in the player menu.
      if (preferred && server.id === preferred.id) return result;

      if (server.version !== "vf") {
        if (allowEnglish) return result;
        english.push(result);
        continue;
      }

      // Auto VF path: skip streams that are clearly English / risky Vidzy unknowns.
      if (language === "en") {
        english.push(result);
        continue;
      }
      if (language === "unknown" && server.host.includes("vidzy")) {
        english.push({ ...result, language: "en" });
        continue;
      }
      if (isTrustedFrench(server, language) || language === "fr" || language === "unknown") {
        return result;
      }
      english.push(result);
    } catch {
      errors.push(`source-${server.id}`);
    }
  }

  if (english.length) {
    if (allowEnglish || preferred) return english[0];
    throw new EnglishChoiceNeededError(catalog);
  }

  throw new Error(
    errors.length
      ? "Lecture indisponible. Réessaie dans un instant."
      : "Version française (VF) indisponible pour ce titre",
  );
}

function isTrustedFrench(server: WatchServer, language: WatchPlayResult["language"]) {
  if (language === "fr") return true;
  if (language !== "unknown") return false;
  return server.host.includes("premium") || server.host.includes("fsvid");
}

async function classifyStreamLanguage(stream: string): Promise<WatchPlayResult["language"]> {
  const lower = stream.toLowerCase();
  const hasFre = /lang\/(fre|fra)\b|\/(fre|fra)\//i.test(lower);
  const hasEng = /lang\/(eng|en)\b|\/eng\//i.test(lower);
  if (hasFre) return "fr";
  if (hasEng) return "en";
  if (!stream.includes(".m3u8")) return "unknown";

  try {
    const response = await fetchMedia(stream);
    if (!response.ok) return "unknown";
    const body = await response.text();
    const lines = body.match(/#EXT-X-MEDIA:[^\n]*/gi) || [];
    let hasFr = false;
    let hasEn = false;
    for (const line of lines) {
      if (!/TYPE=AUDIO/i.test(line)) continue;
      const lang = line.match(/LANGUAGE="([^"]+)"/i)?.[1]?.toLowerCase() || "";
      const name = line.match(/NAME="([^"]+)"/i)?.[1]?.toLowerCase() || "";
      const hay = `${lang} ${name}`;
      if (/^(fr|fra|fre)\b/.test(lang) || hay.includes("french") || hay.includes("fran") || /\bvf\b/.test(hay)) {
        hasFr = true;
      }
      if (/^(en|eng)\b/.test(lang) || hay.includes("english") || hay.includes("anglais")) {
        hasEn = true;
      }
    }
    if (hasFr) return "fr";
    if (hasEn) return "en";
    if (/LANGUAGE="(fr|fra|fre)"/i.test(body)) return "fr";
    if (/LANGUAGE="(en|eng)"/i.test(body)) return "en";
    return "unknown";
  } catch {
    return "unknown";
  }
}


async function followBridge(url: string, origin: string) {
  const needsBridge =
    /kokoflix\.lol|kakaflix\.lol|newPlayer\.php/i.test(url) ||
    /mysync\.mov\/stream\//i.test(url);
  if (!needsBridge) return url;

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: `${origin}/`,
      "Accept-Language": "fr-FR,fr;q=0.9",
    },
    redirect: "follow",
    cache: "no-store",
  });
  const finalUrl = response.url || url;
  if (finalUrl !== url && finalUrl.startsWith("http")) return finalUrl;

  const html = await response.text();
  const redirected =
    html.match(/window\.location\.replace\(["'](https?:[^"']+)["']\)/)?.[1] ||
    html.match(/window\.location\.href\s*=\s*["'](https?:[^"']+)["']/)?.[1] ||
    html.match(/src=["'](https?:[^"']+)["']/)?.[1];
  return redirected?.startsWith("http") ? redirected : finalUrl;
}

async function openEmbed(embed: string, origin: string) {
  if (isDirectMedia(embed)) return embed;

  const resolved = await followBridge(embed, origin);
  if (isDirectMedia(resolved)) return resolved;

  const page = await fetch(resolved, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: `${origin}/`,
      "Accept-Language": "fr-FR,fr;q=0.9",
    },
    cache: "no-store",
  });
  if (!page.ok) throw new Error("Le lecteur n’a pas répondu");
  const html = await page.text();
  const unpacked = unpackEvalScript(html) || "";
  const stream =
    decodePlayerSource(html, resolved) ||
    decodePlayerSource(unpacked, resolved) ||
    decodeXorPayloads(unpacked || html, resolved) ||
    pickRealMediaUrl(decodePackedSource(unpacked || html)) ||
    pickRealMediaUrl(decodePackedSource(html)) ||
    pickRealMediaUrl(
      (unpacked || html).match(/https?:\/\/[^"'\\\s]+\/[^"'\\\s]+\.m3u8[^"'\\\s]*/)?.[0] || null,
    ) ||
    pickRealMediaUrl(
      (unpacked || html).match(/https?:\/\/[^"'\\\s]+\/[^"'\\\s]+\.mp4[^"'\\\s]*/)?.[0] || null,
    ) ||
    null;
  if (!stream) throw new Error("La vidéo est illisible");
  return stream;
}

export function allowedMediaUrl(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const host = parsed.hostname.toLowerCase();
    if (!host || host === "localhost" || host.endsWith(".local")) return false;
    return true;
  } catch {
    return false;
  }
}

export async function fetchMedia(url: string, timeoutMs = 25000) {
  let referer = "https://vidzy.org/";
  let origin = "https://vidzy.org";
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    referer = `https://${host}/`;
    origin = `https://${host}`;
    if (host.includes("vixcloud") || host.includes("vix-content") || host.includes("quickbadger")) {
      referer = "https://vixcloud.co/";
      origin = "https://vixcloud.co";
    } else if (host.includes("vavoo") || url.includes("/hls/") || url.includes("sunshine")) {
      referer = "https://vavoo.to/";
      origin = "https://vavoo.to";
    }
  } catch {
    // keep default
  }
  return fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: referer,
      Origin: origin,
      Accept: "*/*",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export function preparePlaylist(body: string, playlistUrl: string) {
  const rewritten = rewritePlaylist(body, playlistUrl);
  if (!playlistUrl.includes("vixcloud.co")) return rewritten;
  let englishDefault = false;
  const lines = rewritten.split("\n").flatMap((line) => {
    if (/TYPE=SUBTITLES/i.test(line)) return [];
    let next = line.replace(/,?SUBTITLES="[^"]*"/gi, "");
    if (!/TYPE=AUDIO/i.test(next)) return [next];
    const english = /LANGUAGE="en/i.test(next);
    const preferred = english && !englishDefault;
    if (preferred) englishDefault = true;
    next = next
      .replace(/DEFAULT=(YES|NO)/i, preferred ? "DEFAULT=YES" : "DEFAULT=NO")
      .replace(/AUTOSELECT=(YES|NO)/i, preferred ? "AUTOSELECT=YES" : "AUTOSELECT=NO");
    return [next];
  });
  return lines.join("\n");
}

export function rewritePlaylist(body: string, playlistUrl: string) {
  return body
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
          return `URI="${mediaPath(new URL(uri, playlistUrl).toString())}"`;
        });
      }
      return mediaPath(new URL(trimmed, playlistUrl).toString());
    })
    .join("\n");
}

export function mediaPath(url: string) {
  return `/api/watch/media?url=${encodeURIComponent(url)}`;
}


function isFrenchAudioKey(key: string) {
  const normalized = key.trim().toLowerCase();
  // Never treat default / vostfr / vo as French — default is often English VO.
  if (!normalized || normalized === "default" || normalized === "vostfr" || normalized === "vost" || normalized === "vo") {
    return false;
  }
  return (
    normalized === "vf" ||
    normalized === "vff" ||
    normalized === "vfq" ||
    normalized === "truefrench" ||
    normalized === "french" ||
    (normalized.startsWith("vf") && !normalized.startsWith("vost"))
  );
}



function unpackEvalScript(html: string) {
  const packed = html.match(
    /eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\('((?:\\'|[^'])*)',(\d+),(\d+),'((?:\\'|[^'])*)'\.split\('\|'\)\)\)/,
  );
  if (!packed) return null;
  try {
    const payload = packed[1].replace(/\\'/g, "'");
    const radix = Number(packed[2]);
    const count = Number(packed[3]);
    const dictionary = packed[4].replace(/\\'/g, "'").split("|");
    if (!Number.isFinite(radix) || !Number.isFinite(count) || !dictionary.length) return null;
    let unpacked = payload;
    for (let i = count - 1; i >= 0; i -= 1) {
      const token = dictionary[i];
      if (!token) continue;
      unpacked = unpacked.replace(new RegExp(`\\b${i.toString(radix)}\\b`, "g"), token);
    }
    return unpacked;
  } catch {
    return null;
  }
}

function pickRealMediaUrl(url: string | null | undefined) {
  if (!url?.startsWith("http")) return null;
  if (/\/troll\//i.test(url)) return null;
  return url;
}

function decodeXorPayloads(source: string, link: string) {
  const host = (() => {
    try {
      return new URL(link).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  if (!host) return null;
  const payloads = [
    ...source.matchAll(/\(function\s*\(\s*s\s*\)\s*\{[\s\S]*?\}\)\(\s*"([A-Za-z0-9+/=]+)"\s*\)/g),
  ].map((match) => match[1]);
  for (const payload of payloads) {
    if (payload.length < 40) continue;
    const decoded = xorDecodePayload(payload, host);
    const real = pickRealMediaUrl(decoded);
    if (real) return real;
  }
  return null;
}

function xorDecodePayload(payload: string, host: string) {
  let hash = 0;
  for (const char of host) hash = (hash + char.charCodeAt(0)) & 255;
  const reversed = atob(payload).split("").reverse().join("");
  let decoded = "";
  for (let index = 0; index < reversed.length; index += 1) {
    const key = (0x3d + index * 89 + hash) & 255;
    decoded += String.fromCharCode(reversed.charCodeAt(index) ^ key);
  }
  return decoded.startsWith("http") ? decoded : null;
}

function decodePlayerSource(html: string, link: string) {
  const payload = html.match(
    /sources:\s*\[\{src:\s*\(function\(s\)\{[\s\S]*?\}\)\("([A-Za-z0-9+/=]+)"\)/,
  )?.[1];
  if (!payload) return null;
  try {
    return pickRealMediaUrl(xorDecodePayload(payload, new URL(link).hostname.toLowerCase()));
  } catch {
    return null;
  }
}

/** Fallback for packed JWPlayer sources (same idea as the Android VidzyExtractor). */
function decodePackedSource(html: string) {
  const direct =
    html.match(/sources:\s*\[\s*\{\s*(?:file|src)\s*:\s*["'](https?:[^"']+)["']/)?.[1] ||
    html.match(/file:\s*["'](https?:[^"']+\.m3u8[^"']*)["']/)?.[1];
  if (direct?.startsWith("http")) return direct;

  const packed = html.match(/}\s*\('((?:\\'|[^'])*)',\s*(\d+),\s*(\d+),\s*'((?:\\'|[^'])*)'\.split\('\|'\)/);
  if (!packed) return null;
  try {
    const payload = packed[1].replace(/\\'/g, "'");
    const radix = Number(packed[2]);
    const count = Number(packed[3]);
    const dictionary = packed[4].replace(/\\'/g, "'").split("|");
    if (!Number.isFinite(radix) || !Number.isFinite(count) || !dictionary.length) return null;
    let unpacked = payload;
    for (let i = count - 1; i >= 0; i -= 1) {
      const token = dictionary[i];
      if (!token) continue;
      const pattern = new RegExp(`\\b${i.toString(radix)}\\b`, "g");
      unpacked = unpacked.replace(pattern, token);
    }
    return (
      pickRealMediaUrl(
        unpacked.match(/sources:\s*\[\s*\{\s*(?:file|src)\s*:\s*["'](https?:[^"']+)["']/)?.[1],
      ) ||
      pickRealMediaUrl(unpacked.match(/src\s*:\s*["'](https?:[^"']+)["']/)?.[1]) ||
      decodeXorPayloads(unpacked, "https://fsvid.lol/") ||
      null
    );
  } catch {
    return null;
  }
}

function stripHtml(value: string) {
  return decodeTitle(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
}

function decodeTitle(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}
