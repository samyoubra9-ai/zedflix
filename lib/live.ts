const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";
const BASE = "https://vavoo.to";
const CATALOG = `${BASE}/mediahubmx-catalog.json`;
const RESOLVE = `${BASE}/mediahubmx-resolve.json`;
const FR_LOGO_BASE =
  "https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/france/";
function usableLogo(logo?: string | null) {
  const value = logo?.trim() || "";
  return value.length > 0 && !value.includes("clipartmax.com");
}
const CACHE_MS = 20 * 60 * 1000;

const GROUPS = [
  { id: "France", label: "Chaînes françaises" },
  { id: "France Sport", label: "Sport" },
] as const;

const LOGO_ALIASES: Record<string, string> = {
  "tf1": "tf1",
  "tf1 series films": "tf1-series-films",
  "tf1 plus": "tf1-plus",
  "tfx": "tfx",
  "tmc": "tmc",
  "france 2": "france-2",
  "france 3": "france-3",
  "france 4": "france-4",
  "france 5": "france-5",
  "franceinfo": "franceinfo",
  "france info": "franceinfo",
  "france 24": "france-24",
  "m6": "m6",
  "w9": "w9",
  "6ter": "6ter",
  "arte": "arte",
  "c8": "c8",
  "cnews": "c-news",
  "c news": "c-news",
  "cstar": "c-star",
  "c star": "c-star",
  "canal plus": "canal-plus",
  "canal plus cinema": "canal-plus-cinemas",
  "canal plus series": "canal-plus-series",
  "canal plus sport": "canal-plus-sport",
  "canal plus docs": "canal-plus-docs",
  "canal plus kids": "canal-plus-kids",
  "canal plus foot": "canal-plus-foot",
  "canal plus grand ecran": "canal-plus-grand-ecran",
  "bfm tv": "bfm-tv",
  "bfmtv": "bfm-tv",
  "bfm business": "bfm-business",
  "rmc story": "rmc-story",
  "rmc decouverte": "rmc-decouverte",
  "rmc sport": "rmc-sport",
  "lci": "lci",
  "lcp": "lcp",
  "l equipe": "lequipe",
  "lequipe": "lequipe",
  "gulli": "gulli",
  "nrj 12": "nrj-12",
  "nrj hits": "nrj-hits",
  "paris premiere": "paris-premiere",
  "teva": "teva",
  "tiji": "tiji",
  "piwi plus": "piwi-plus",
  "teletoon plus": "teletoon-plus",
  "canal j": "canal-j",
  "disney channel": "disney-channel",
  "nickelodeon": "nickelodeon",
  "cartoon network": "cartoon-network",
  "boomerang": "boomerang",
  "eurosport 1": "eurosport-1",
  "eurosport 2": "eurosport-2",
  "bein sports 1": "bein-sports-1-french",
  "bein sports 2": "bein-sports-2-french",
  "bein sports 3": "bein-sports-3-french",
  "bein sports": "bein-sports",
  "equidia": "equidia",
  "golf plus": "golf-plus",
  "infosport plus": "infosport-plus",
  "ushuaia tv": "ushuaia-tv",
  "histoire tv": "histoire-tv",
  "science et vie tv": "science-and-vie-tv",
  "tv5 monde": "tv5-monde",
  "warner tv": "warner-tv",
  "serie club": "serie-club",
  "rtl9": "rtl9",
  "ab 1": "ab1",
  "ab1": "ab1",
  "ab 3": "ab3",
  "ab3": "ab3",
  "action": "action",
  "comedie plus": "comedie-plus",
  "polar plus": "polar-plus",
  "game one": "game-one",
  "j one": "j-one",
  "mangas": "mangas",
  "trace urban": "trace-urban",
  "public senat": "public-senat",
  "la chaine meteo": "la-chaine-meteo",
  "automoto": "automoto-la-chaine",
  "chasse et peche": "chasse-et-peche",
  "toute l histoire": "toute-lhistoire",
  "planete plus": "planete-plus",
  "tcm cinema": "tcm-cinema",
  "cine plus premier": "cine-plus-premier",
  "cine plus frisson": "cine-plus-frisson",
  "cine plus emotion": "cine-plus-emotion",
  "cine plus classic": "cine-plus-classic",
  "cine plus family": "cine-plus-family",
  "cine plus festival": "cine-plus-festival"
};

const FR_LOGO_SLUGS = new Set<string>([
  "6ter",
  "ab1",
  "ab3",
  "abx",
  "action",
  "altice-studio",
  "animaux",
  "arte",
  "automoto-la-chaine",
  "b-smart",
  "bein-sports-1-french",
  "bein-sports-2-french",
  "bein-sports-3-french",
  "bein-sports",
  "bet",
  "bfm-business",
  "bfm-grand-lille",
  "bfm-grand-littoral",
  "bfm-lyon",
  "bfm-paris",
  "bfm-tv",
  "boing",
  "boomerang",
  "c-news",
  "c-news-prime",
  "c-star",
  "c8",
  "canal-j",
  "canal-plus-box-office",
  "canal-plus-cinemas",
  "canal-plus-docs",
  "canal-plus-foot",
  "canal-plus-formula1",
  "canal-plus",
  "canal-plus-grand-ecran",
  "canal-plus-hello",
  "canal-plus-kids",
  "canal-plus-ligue1",
  "canal-plus-magic",
  "canal-plus-moto-gp",
  "canal-plus-outremer",
  "canal-plus-premier-league",
  "canal-plus-series",
  "canal-plus-sport-360",
  "canal-plus-sport",
  "canal-plus-story",
  "canal-plus-top-14-rugby",
  "cartoon-network",
  "chasse-et-peche",
  "cine-plus-classic",
  "cine-plus-emotion",
  "cine-plus-family",
  "cine-plus-festival",
  "cine-plus-frisson",
  "cine-plus-ocs",
  "cine-plus-premier",
  "comedie-plus",
  "crime-district",
  "culturebox",
  "disney-channel",
  "disney-jr",
  "dreamsee",
  "drive-in-movie-channel",
  "equidia",
  "europe-2-pop-tv",
  "europe1-tv",
  "eurosport-1",
  "eurosport-2",
  "france-2",
  "france-24",
  "france-3",
  "france-4",
  "france-5",
  "franceinfo",
  "game-one",
  "golf-plus",
  "gulli",
  "histoire-tv",
  "infosport-plus",
  "j-one",
  "kto",
  "la-chaine-meteo",
  "lci",
  "lcp",
  "lequipe",
  "ligue-1plus",
  "m6",
  "m6-music",
  "mangas",
  "mcm",
  "melody",
  "mezzo",
  "mezzo-live",
  "nickelodeon",
  "nickelodeon-junior",
  "nickelodeon-teen",
  "nrj-12",
  "nrj-hits",
  "ocs",
  "paris-premiere",
  "piwi-plus",
  "planete-plus",
  "polar-plus",
  "public-senat",
  "rmc-decouverte",
  "rmc-life",
  "rmc-sport",
  "rmc-sport-news",
  "rmc-story",
  "rtl9",
  "science-and-vie-tv",
  "seasons",
  "serie-club",
  "sport-en-france",
  "t18",
  "tcm-cinema",
  "teletoon-plus",
  "teva",
  "tf1",
  "tf1-plus",
  "tf1-series-films",
  "tfx",
  "tiji",
  "tlc",
  "tmc",
  "toute-lhistoire",
  "trace-urban",
  "trek",
  "tv-breizh",
  "tv5-monde",
  "ushuaia-tv",
  "w9",
  "warner-tv"
]);

export type LiveChannel = {
  id: string;
  name: string;
  logo: string;
  url: string;
};

export type LiveGroup = {
  id: string;
  name: string;
  channels: LiveChannel[];
};

type CacheEntry = { at: number; groups: LiveGroup[] };
let catalogCache: CacheEntry | null = null;
const byId = new Map<string, LiveChannel>();

function headers() {
  return {
    "User-Agent": USER_AGENT,
    Origin: BASE,
    Referer: `${BASE}/`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/** Clean display name: drop stream tags like ".b", "HD .s", etc. */
export function displayName(raw: string) {
  return raw
    .replace(/\s*\.[a-z]\s*$/i, "")
    .replace(/\s+(?:UHD|4K|FHD|HD|SD)\b.*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function channelKey(name: string) {
  return displayName(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** UHD is often audio-only in Chrome. Otherwise keep the Vavoo feed as-is. */
function webQualityScore(name: string) {
  const upper = name.toUpperCase();
  if (/\bUHD\b|\b4K\b/.test(upper)) return 1;
  if (/\bSD\b/.test(upper)) return 2;
  if (/\bFHD\b|\b1080/.test(upper)) return 5;
  if (/\bHD\b|\b720/.test(upper)) return 4;
  return 3;
}

function slugify(key: string) {
  return key.replace(/ /g, "-").replace(/-{2,}/g, "-");
}

export function resolveLogo(display: string, apiLogo?: string | null) {
  if (usableLogo(apiLogo)) return apiLogo!.trim();
  const key = channelKey(display);
  const alias = LOGO_ALIASES[key];
  const slug = alias || (FR_LOGO_SLUGS.has(slugify(key)) ? slugify(key) : null);
  return slug ? `${FR_LOGO_BASE}${slug}-fr.png` : "";
}

type RawItem = {
  name?: string;
  url?: string;
  logo?: string;
  ids?: { id?: string };
};

async function fetchCatalogPage(group: string, cursor: number | null) {
  const response = await fetch(CATALOG, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      language: "fr",
      region: "FR",
      catalogId: "iptv",
      id: "",
      adult: false,
      search: "",
      sort: "name",
      filter: { group },
      cursor,
    }),
    cache: "no-store",
  });
  if (!response.ok) return { items: [] as RawItem[], next: null as number | null };
  const data = (await response.json()) as {
    items?: RawItem[];
    nextCursor?: number | null;
  };
  const next =
    data.nextCursor === undefined || data.nextCursor === null
      ? null
      : Number(data.nextCursor);
  return {
    items: data.items || [],
    next: Number.isFinite(next) ? next : null,
  };
}

function preferBest(channels: Array<LiveChannel & { rawName?: string }>) {
  const map = new Map<string, LiveChannel & { rawName?: string }>();
  for (const channel of channels) {
    const key = channelKey(channel.name);
    const current = map.get(key);
    if (!current) {
      map.set(key, channel);
      continue;
    }
    const betterLogo = Number(usableLogo(channel.logo)) - Number(usableLogo(current.logo));
    const betterQuality =
      webQualityScore(channel.rawName || channel.name) -
      webQualityScore(current.rawName || current.name);
    if (betterLogo > 0 || (betterLogo === 0 && betterQuality > 0)) {
      map.set(key, channel);
    }
  }
  return [...map.values()]
    .map(({ id, name, logo, url }) => ({ id, name, logo, url }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

function mapRawChannels(items: RawItem[]) {
  return items
    .map((item) => {
      const url = item.url?.trim() || "";
      const rawName = item.name?.trim() || "";
      if (!url || !rawName) return null;
      const name = displayName(rawName);
      const id = item.ids?.id?.trim() || url.replace(/^.*\//, "");
      return {
        id,
        name,
        rawName,
        logo: resolveLogo(name, item.logo),
        url,
      };
    })
    .filter((item): item is LiveChannel & { rawName: string } => !!item);
}

async function fetchGroup(group: string): Promise<LiveChannel[]> {
  const items: RawItem[] = [];
  let cursor: number | null = null;
  for (let page = 0; page < 20; page += 1) {
    const result = await fetchCatalogPage(group, cursor);
    items.push(...result.items);
    if (result.next === null) break;
    cursor = result.next;
  }

  const channels = mapRawChannels(items);

  const logos = new Map<string, string>();
  for (const channel of channels) {
    if (usableLogo(channel.logo)) {
      logos.set(channelKey(channel.name), channel.logo);
    }
  }

  return preferBest(
    channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      rawName: channel.rawName,
      url: channel.url,
      logo: usableLogo(channel.logo)
        ? channel.logo
        : logos.get(channelKey(channel.name)) || "",
    })),
  );
}

export type LiveSlice = {
  groups: LiveGroup[];
  next: string | null;
};

/** One catalog page. The first call returns as soon as the first page arrives. */
export async function liveCatalogSlice(token: string | null): Promise<LiveSlice> {
  if (!token && catalogCache && Date.now() - catalogCache.at < CACHE_MS) {
    for (const group of catalogCache.groups) {
      for (const channel of group.channels) byId.set(channel.id, channel);
    }
    return { groups: catalogCache.groups, next: null };
  }

  const [groupRaw, cursorRaw] = (token || "0:").split(":");
  const groupIndex = Number(groupRaw);
  if (!Number.isInteger(groupIndex) || groupIndex < 0 || groupIndex >= GROUPS.length) {
    return { groups: [], next: null };
  }

  const group = GROUPS[groupIndex];
  const cursor = cursorRaw && Number.isFinite(Number(cursorRaw)) ? Number(cursorRaw) : null;
  const page = await fetchCatalogPage(group.id, cursor);
  const channels = preferBest(mapRawChannels(page.items));
  for (const channel of channels) byId.set(channel.id, channel);

  const hasMoreInGroup = page.next != null && page.items.length > 0;
  const next = hasMoreInGroup
    ? `${groupIndex}:${page.next}`
    : groupIndex + 1 < GROUPS.length
      ? `${groupIndex + 1}:`
      : null;

  return {
    groups: channels.length
      ? [{ id: group.id, name: group.label, channels }]
      : [],
    next,
  };
}

export async function liveCatalog(): Promise<LiveGroup[]> {
  if (catalogCache && Date.now() - catalogCache.at < CACHE_MS) {
    return catalogCache.groups;
  }

  const groups: LiveGroup[] = [];
  for (const group of GROUPS) {
    const channels = await fetchGroup(group.id);
    for (const channel of channels) byId.set(channel.id, channel);
    if (channels.length) {
      groups.push({
        id: group.id,
        name: group.label,
        channels,
      });
    }
  }

  catalogCache = { at: Date.now(), groups };
  return groups;
}

function directPlayUrl(id: string) {
  if (id.startsWith("http://") || id.startsWith("https://")) {
    let parsed: URL;
    try {
      parsed = new URL(id);
    } catch {
      throw new Error("Chaîne introuvable");
    }
    if (parsed.hostname !== "vavoo.to") throw new Error("Chaîne introuvable");
    return id;
  }
  return `${BASE}/vavoo-iptv/play/${id}`;
}

export async function resolveLiveStream(id: string) {
  const trimmed = id.trim();
  if (!trimmed) throw new Error("Chaîne introuvable");

  const channel = byId.get(trimmed);
  const playUrl = channel?.url || directPlayUrl(trimmed);

  const response = await fetch(RESOLVE, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      language: "fr",
      region: "FR",
      url: playUrl,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Impossible de résoudre le flux live");
  const data = (await response.json()) as Array<{ url?: string; name?: string }>;
  const stream = data?.[0]?.url?.trim();
  if (!stream?.startsWith("http")) throw new Error("Flux live indisponible");

  return {
    stream,
    name: channel?.name || displayName(data[0]?.name || "Direct"),
    logo: usableLogo(channel?.logo) ? channel!.logo : "",
  };
}

export function liveWatchPath(id: string) {
  return `/watch/live/${encodeURIComponent(id)}`;
}
