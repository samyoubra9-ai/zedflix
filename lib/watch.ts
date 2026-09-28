const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

const PORTAL = "https://fstream.info/";
const FALLBACK_ORIGIN = "https://fs16.lol";

export type WatchResult = {
  id: string;
  title: string;
  poster: string;
  kind: "movie" | "show";
};

let cachedOrigin: { value: string; at: number } | null = null;

export async function catalogOrigin() {
  if (cachedOrigin && Date.now() - cachedOrigin.at < 10 * 60 * 1000) {
    return cachedOrigin.value;
  }
  try {
    const html = await fetch(PORTAL, { headers: { "User-Agent": USER_AGENT }, cache: "no-store" }).then((response) =>
      response.text(),
    );
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

export type WatchHome = {
  hero: WatchCard[];
  rows: { name: string; items: WatchCard[] }[];
};

let cachedHome: { at: number; value: WatchHome } | null = null;

export async function homeCatalog(): Promise<WatchHome> {
  if (cachedHome && Date.now() - cachedHome.at < 10 * 60 * 1000) return cachedHome.value;
  const origin = await catalogOrigin();
  // Accueil général mélange VOSTFR : on prend les listes VF dédiées.
  const [filmsPage, seriesPage] = await Promise.all([
    fetch(`${origin}/films/vf/`, { headers: headers(origin), cache: "no-store" }),
    fetch(`${origin}/s-tv/s-vf/`, { headers: headers(origin), cache: "no-store" }),
  ]);
  if (!filmsPage.ok && !seriesPage.ok) throw new Error("L’accueil est indisponible");
  const films = filmsPage.ok
    ? parseListing(await filmsPage.text(), "movie").filter(hasFrenchVersion)
    : [];
  const series = seriesPage.ok
    ? parseListing(await seriesPage.text(), "show").filter(hasFrenchVersion)
    : [];
  const heroSource = [...films.slice(0, 4), ...series.slice(0, 4)];
  const hero = await Promise.all(heroSource.map(withBackdrop));
  const value: WatchHome = {
    hero,
    rows: [
      { name: "Films du moment", items: films },
      { name: "Séries du moment", items: series.slice(0, 12) },
      { name: "Encore des séries", items: series.slice(12) },
    ].filter((row) => row.items.length > 0),
  };
  cachedHome = { at: Date.now(), value };
  return value;
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

const FALLBACK_GENRES: WatchGenre[] = [
  { id: "action", name: "Action" },
  { id: "animation", name: "Animation" },
  { id: "aventure", name: "Aventure" },
  { id: "comedie", name: "Comédie" },
  { id: "crime", name: "Crime" },
  { id: "documentaire", name: "Documentaire" },
  { id: "drame", name: "Drame" },
  { id: "fantastique", name: "Fantastique" },
  { id: "guerre", name: "Guerre" },
  { id: "historique", name: "Historique" },
  { id: "horreur", name: "Horreur" },
  { id: "romance", name: "Romance" },
  { id: "science-fiction", name: "Science-fiction" },
  { id: "thriller", name: "Thriller" },
  { id: "western", name: "Western" },
];

let cachedGenres: { at: number; value: WatchGenre[] } | null = null;

export async function listGenres(): Promise<WatchGenre[]> {
  if (cachedGenres && Date.now() - cachedGenres.at < 30 * 60 * 1000) return cachedGenres.value;
  try {
    const origin = await catalogOrigin();
    const response = await fetch(`${origin}/`, { headers: headers(origin), cache: "no-store" });
    if (!response.ok) throw new Error("fail");
    const html = await response.text();
    const block =
      html.match(/class="menu-section"[^>]*>([\s\S]*?)<\/div>/)?.[1] ||
      html.match(/id="menu-section"[^>]*>([\s\S]*?)<\/div>/)?.[1] ||
      "";
    const genres: WatchGenre[] = [];
    const seen = new Set<string>();
    for (const match of block.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g)) {
      const href = match[1];
      const name = decodeTitle(match[2]).trim();
      if (!name || name.length > 28) continue;
      const id = href.replace(/\/+$/, "").split("/").pop() || "";
      if (!id || seen.has(id) || /^(films|s-tv|series|accueil|home)$/i.test(id)) continue;
      seen.add(id);
      genres.push({ id, name });
    }
    const value = genres.length >= 6 ? genres.slice(0, 24) : FALLBACK_GENRES;
    cachedGenres = { at: Date.now(), value };
    return value;
  } catch {
    return FALLBACK_GENRES;
  }
}

export async function genreCatalog(genreId: string, page = 1) {
  const id = genreId.trim().replace(/^\/+|\/+$/g, "");
  if (!/^[a-zA-Z0-9-]{2,60}$/.test(id)) throw new Error("Genre introuvable");
  const origin = await catalogOrigin();
  const safePage = Math.max(1, Math.min(40, Math.floor(page) || 1));
  const path = `/film-en-streaming/${encodeURIComponent(id)}/page/${safePage}`;
  const response = await fetch(`${origin}${path}`, { headers: headers(origin), cache: "no-store" });
  if (!response.ok) throw new Error("Genre indisponible");
  const items = parseListing(await response.text(), "movie").filter(hasFrenchVersion);
  const genres = await listGenres();
  const name = genres.find((item) => item.id === id)?.name || id;
  return { id, name, items, page: safePage, hasMore: items.length >= 12 };
}

export async function titleCatalog(id: string, kind: WatchResult["kind"]): Promise<WatchTitle> {
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

export async function peopleCatalog(id: string, page = 1) {
  const origin = await catalogOrigin();
  const safePage = Math.max(1, Math.min(40, Math.floor(page) || 1));
  const slug = id.trim().replace(/\s+/g, "+");
  if (!slug) throw new Error("Acteur introuvable");
  const path = `/xfsearch/actors/${encodeURIComponent(slug).replace(/%2B/gi, "+")}/page/${safePage}`;
  const response = await fetch(`${origin}${path}`, { headers: headers(origin), cache: "no-store" });
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
  const origin = await catalogOrigin();
  const response = await fetch(`${origin}/engine/ajax/search.php`, {
    method: "POST",
    headers: {
      ...headers(origin),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ query, page: "1" }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Recherche impossible");
  const html = await response.text();
  const results: WatchResult[] = [];
  const pattern =
    /<div class='search-item' onclick="location\.href='([^']+)'"[\s\S]*?<img src='([^']*)'[\s\S]*?<div class='search-title'>([^<]+)/g;
  for (const match of html.matchAll(pattern)) {
    const href = match[1];
    const title = decodeTitle(match[3]);
    const id = href.match(/\/(\d+)-/)?.[1];
    if (!id) continue;
    const show = /saison/i.test(href) || /saison/i.test(title);
    results.push({
      id,
      title,
      poster: match[2],
      kind: show ? "show" : "movie",
    });
  }

  // Also try actor filmography lookup (same path as the Android app).
  const people: { id: string; name: string; count: number }[] = [];
  try {
    const actor = await peopleCatalog(query, 1);
    if (actor.items.length) {
      people.push({
        id: actor.id,
        name: actor.name,
        count: actor.items.length,
      });
    }
  } catch {
    // ignore actor miss
  }

  return { results, people };
}

export async function showCatalog(id: string) {
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
    const show =
      kind === "show" ||
      /saison/i.test(title) ||
      posterHref.includes("-saison-") ||
      posterHref.includes("/s-tv/");
    items.push({
      id,
      title,
      poster,
      overview: "",
      backdrop: poster,
      kind: show ? "show" : "movie",
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

export type WatchServer = {
  id: string;
  name: string;
  src: string;
};

export type WatchPlayResult = {
  stream: string;
  server: string;
  servers: Array<{ id: string; name: string }>;
};

/** Resolve a playable stream like the Android app: all VF servers, Vidzy first, auto-fallback. */
export async function resolvePlaylist(id: string, preferredServer?: string): Promise<WatchPlayResult> {
  const origin = await catalogOrigin();
  const film = await filmData(origin, id);
  const servers = listMovieServers(film.players || {});
  return playFromServers(servers, origin, preferredServer);
}

/** @deprecated alias kept for older imports */
export async function vidzyPlaylist(id: string, preferredServer?: string) {
  const result = await resolvePlaylist(id, preferredServer);
  return result.stream;
}

export async function resolveEpisode(
  seasonId: string,
  episode: number,
  preferredServer?: string,
): Promise<WatchPlayResult> {
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
  const servers = listEpisodeServers(data.vf?.[String(episode)]);
  return playFromServers(servers, origin, preferredServer);
}

/** @deprecated alias kept for older imports */
export async function vidzyEpisode(seasonId: string, episode: number, preferredServer?: string) {
  const result = await resolveEpisode(seasonId, episode, preferredServer);
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

function langLabel(key: string) {
  const labels: Record<string, string> = {
    vff: "TrueFrench",
    vfq: "French",
    vf: "VF",
    truefrench: "TrueFrench",
    french: "French",
    default: "VF",
  };
  return labels[key.toLowerCase()] || "VF";
}

function providerLabel(provider: string) {
  return provider.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function ignoreSource(source: string, href: string) {
  if (source.trim().toLowerCase() === "dood.stream" && href.includes("/bigwar5/")) return true;
  return false;
}

function isDirectMedia(url: string) {
  return /\.(m3u8|mp4|mkv|webm)(\?|$)/i.test(url) || url.includes(".m3u8");
}

/** Mirror Android FrenchStreamProvider.getServers for movies (VF only). */
function listMovieServers(players: Record<string, Record<string, string>>): WatchServer[] {
  const langOrder = ["vff", "vfq", "vf", "truefrench", "french", "default"];
  const servers: WatchServer[] = [];
  let index = 0;

  for (const [provider, langMap] of Object.entries(players)) {
    const seen = new Set<string>();
    const defaultUrl = langMap.default || langMap.Default;

    const frenchEntries = Object.entries(langMap)
      .filter(([key]) => key.toLowerCase() !== "default" && isFrenchAudioKey(key))
      .sort(([a], [b]) => {
        const ai = langOrder.indexOf(a.toLowerCase());
        const bi = langOrder.indexOf(b.toLowerCase());
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });

    for (const [lang, url] of frenchEntries) {
      if (!url || (!url.startsWith("http") && !url.trim()) || ignoreSource(provider, url) || seen.has(url)) {
        continue;
      }
      seen.add(url);
      servers.push({
        id: `vid${index++}`,
        name: `${providerLabel(provider)} (${langLabel(lang)})`,
        src: url,
      });
    }

    const keys = Object.keys(langMap).map((key) => key.toLowerCase());
    const hasForeignSibling = keys.some((key) => key === "vostfr" || key === "vost" || key === "vo");
    if (
      !hasForeignSibling &&
      seen.size === 0 &&
      defaultUrl &&
      defaultUrl.startsWith("http") &&
      !ignoreSource(provider, defaultUrl)
    ) {
      servers.push({
        id: `vid${index++}`,
        name: `${providerLabel(provider)} (VF)`,
        src: defaultUrl,
      });
    }
  }

  return sortServers(servers);
}

/** Mirror Android episode VF map: every host in vf[episode], never vostfr/vo. */
function listEpisodeServers(block: Record<string, string> | undefined): WatchServer[] {
  if (!block) return [];
  const servers: WatchServer[] = [];
  let index = 0;
  for (const [provider, url] of Object.entries(block)) {
    if (!url?.startsWith("http") || ignoreSource(provider, url)) continue;
    servers.push({
      id: `ep${index++}`,
      name: `${providerLabel(provider)} (VF)`,
      src: url,
    });
  }
  return sortServers(servers);
}

/**
 * Prefer the same hosts the Android app tends to play first.
 * FrenchStream often exposes only `default` URLs: Vidzy's default is frequently
 * English VO, while premium/fsvid is the real French dub.
 */
function sortServers(servers: WatchServer[]) {
  const score = (server: WatchServer) => {
    const hay = `${server.name} ${server.src}`.toLowerCase();
    if (hay.includes("premium") || hay.includes("fsvid")) return 0;
    if (hay.includes("uqload")) return 1;
    if (hay.includes("vidoza")) return 2;
    if (hay.includes("filemoon") || hay.includes("filmoon") || hay.includes("streamwish")) return 3;
    if (hay.includes("vidzy")) return 8; // often English when only `default` exists
    if (hay.includes("dood") || hay.includes("voe")) return 9;
    return 5;
  };
  // Stable sort: keep API order when scores tie (like the Android first() pick).
  return servers
    .map((server, index) => ({ server, index }))
    .sort((a, b) => {
      const diff = score(a.server) - score(b.server);
      return diff !== 0 ? diff : a.index - b.index;
    })
    .map(({ server }) => server);
}

async function playFromServers(
  servers: WatchServer[],
  origin: string,
  preferredServer?: string,
): Promise<WatchPlayResult> {
  if (!servers.length) {
    throw new Error("Version française (VF) indisponible pour ce titre");
  }

  const ordered = preferredServer
    ? [
        ...servers.filter((server) => server.id === preferredServer),
        ...servers.filter((server) => server.id !== preferredServer),
      ]
    : servers;

  const errors: string[] = [];
  for (const server of ordered) {
    try {
      const stream = await openEmbed(server.src, origin);
      if (!stream) {
        errors.push(`${server.name}: illisible`);
        continue;
      }
      return {
        stream,
        server: server.id,
        servers: servers.map(({ id, name }) => ({ id, name })),
      };
    } catch (error) {
      errors.push(`${server.name}: ${error instanceof Error ? error.message : "échec"}`);
    }
  }

  throw new Error(
    errors.length
      ? `Aucun serveur VF lisible (${errors.slice(0, 3).join(" · ")})`
      : "Version française (VF) indisponible pour ce titre",
  );
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

export async function fetchMedia(url: string) {
  let referer = "https://vidzy.org/";
  try {
    const host = new URL(url).hostname.toLowerCase();
    referer = `https://${host}/`;
  } catch {
    // keep default
  }
  return fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: referer,
    },
    cache: "no-store",
  });
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
  const reversed = Buffer.from(payload, "base64").toString("latin1").split("").reverse().join("");
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
