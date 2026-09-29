const TMDB = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";

export type MediaItem = {
  id: number;
  title: string;
  overview: string;
  poster: string | null;
  backdrop: string | null;
  mediaType: "movie" | "tv";
  year: string;
  rating: number;
  badge?: string;
};

export type MediaRow = {
  id: string;
  title: string;
  items: MediaItem[];
};

export type VideoSource = {
  key: string;
  name: string;
  site: "YouTube" | string;
  type: string;
  official: boolean;
};

export type MediaDetails = MediaItem & {
  runtime: number | null;
  genres: string[];
  tagline: string;
  videos: VideoSource[];
  similar: MediaItem[];
  seasons?: { id: number; name: string; episodeCount: number; seasonNumber: number }[];
};

type TmdbResult = {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  runtime?: number;
  episode_run_time?: number[];
  genres?: { id: number; name: string }[];
  tagline?: string;
  videos?: { results?: TmdbVideo[] };
  similar?: { results?: TmdbResult[] };
  seasons?: {
    id: number;
    name: string;
    episode_count: number;
    season_number: number;
  }[];
};

type TmdbVideo = {
  key: string;
  name: string;
  site: string;
  type: string;
  official?: boolean;
};

function key() {
  return process.env.TMDB_API_KEY || "";
}

export function mediaHref(item: Pick<MediaItem, "mediaType" | "id">) {
  return `/title/${item.mediaType}/${item.id}`;
}

export function watchHref(
  item: Pick<MediaItem, "mediaType" | "id"> | { type: "movie" | "tv"; id: number },
  videoKey?: string,
) {
  const mediaType = "mediaType" in item ? item.mediaType : item.type;
  const base = `/watch/${mediaType}/${item.id}`;
  return videoKey ? `${base}?v=${encodeURIComponent(videoKey)}` : base;
}

function mapItem(item: TmdbResult, forceType?: "movie" | "tv"): MediaItem | null {
  const mediaType =
    forceType ||
    (item.media_type === "tv" ? "tv" : item.media_type === "movie" ? "movie" : item.title ? "movie" : "tv");
  const title = (item.title || item.name || "").trim();
  if (!title || !item.id) return null;
  const date = item.release_date || item.first_air_date || "";
  return {
    id: item.id,
    title,
    overview: item.overview || "",
    poster: item.poster_path ? `${IMG}/w342${item.poster_path}` : null,
    backdrop: item.backdrop_path ? `${IMG}/original${item.backdrop_path}` : null,
    mediaType,
    year: date.slice(0, 4),
    rating: Math.round((item.vote_average || 0) * 10) / 10,
  };
}

async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  const apiKey = key();
  if (!apiKey) return null;
  const url = new URL(`${TMDB}${path}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", "fr-FR");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 6 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function list(
  path: string,
  forceType?: "movie" | "tv",
  params: Record<string, string> = {},
  badge?: string,
): Promise<MediaItem[]> {
  const data = await tmdbFetch<{ results?: TmdbResult[] }>(path, params);
  return (data?.results || [])
    .map((item) => {
      const mapped = mapItem(item, forceType);
      if (!mapped) return null;
      return badge ? { ...mapped, badge } : mapped;
    })
    .filter((item): item is MediaItem => Boolean(item?.backdrop || item?.poster))
    .slice(0, 18);
}

function pickVideos(results: TmdbVideo[] | undefined): VideoSource[] {
  const videos = (results || [])
    .filter((v) => v.site === "YouTube" && v.key)
    .map((v) => ({
      key: v.key,
      name: v.name,
      site: v.site,
      type: v.type,
      official: Boolean(v.official),
    }));

  const rank = (v: VideoSource) => {
    const t = v.type.toLowerCase();
    if (t === "trailer" && v.official) return 0;
    if (t === "trailer") return 1;
    if (t === "teaser") return 2;
    if (t === "clip") return 3;
    return 4;
  };

  return videos.sort((a, b) => rank(a) - rank(b));
}

export async function getMediaDetails(
  type: "movie" | "tv",
  id: string | number,
): Promise<MediaDetails | null> {
  const data = await tmdbFetch<TmdbResult>(`/${type}/${id}`, {
    append_to_response: "videos,similar",
  });
  if (!data) return null;

  // Prefer French videos; fallback to EN if empty
  let videos = pickVideos(data.videos?.results);
  if (videos.length === 0) {
    const en = await tmdbFetch<{ results?: TmdbVideo[] }>(`/${type}/${id}/videos`, {
      language: "en-US",
    });
    videos = pickVideos(en?.results);
  }

  const base = mapItem(data, type);
  if (!base) return null;

  return {
    ...base,
    runtime:
      type === "movie"
        ? data.runtime || null
        : data.episode_run_time?.[0] || null,
    genres: (data.genres || []).map((g) => g.name),
    tagline: data.tagline || "",
    videos,
    similar: (data.similar?.results || [])
      .map((item) => mapItem(item, type))
      .filter((item): item is MediaItem => Boolean(item)),
    seasons:
      type === "tv"
        ? (data.seasons || [])
            .filter((s) => s.season_number > 0)
            .map((s) => ({
              id: s.id,
              name: s.name,
              episodeCount: s.episode_count,
              seasonNumber: s.season_number,
            }))
        : undefined,
  };
}

export async function getHomeCatalog(): Promise<{
  featured: MediaItem | null;
  rows: MediaRow[];
}> {
  const [
    trending,
    popularMovies,
    popularTv,
    topMovies,
    topTv,
    action,
    crime,
    animation,
    scifi,
  ] = await Promise.all([
    list("/trending/all/week"),
    list("/movie/popular", "movie", {}, "Tendance"),
    list("/tv/popular", "tv"),
    list("/movie/top_rated", "movie"),
    list("/tv/top_rated", "tv"),
    list("/discover/movie", "movie", { with_genres: "28", sort_by: "popularity.desc" }),
    list("/discover/tv", "tv", { with_genres: "80", sort_by: "popularity.desc" }, "Acclamée"),
    list("/discover/movie", "movie", { with_genres: "16", sort_by: "popularity.desc" }),
    list("/discover/tv", "tv", { with_genres: "10765", sort_by: "popularity.desc" }),
  ]);

  const featured =
    trending.find((item) => item.backdrop && item.overview) ||
    trending[0] ||
    popularMovies[0] ||
    null;

  const rows: MediaRow[] = [
    { id: "trending", title: "Tendances de la semaine", items: trending },
    { id: "for-you", title: "Meilleurs choix pour vous aujourd'hui", items: popularMovies },
    { id: "series", title: "Séries populaires", items: popularTv },
    { id: "films", title: "Films populaires", items: popularMovies },
    { id: "top-movies", title: "Films les mieux notés", items: topMovies },
    { id: "top-tv", title: "Séries acclamées", items: topTv },
    { id: "action", title: "Action & aventure", items: action },
    { id: "crime", title: "Enquêtes & polar", items: crime },
    { id: "animation", title: "Animation", items: animation },
    { id: "scifi", title: "Science-fiction & fantastique", items: scifi },
  ].filter((row) => row.items.length > 0);

  return { featured, rows };
}

/** Public landing visuals — backdrops + posters, no account required. */
export async function getVitrineMedia(): Promise<{
  backdrops: { title: string; backdrop: string }[];
  posters: { title: string; poster: string }[];
}> {
  const [trending, popularMovies, popularTv] = await Promise.all([
    list("/trending/all/week"),
    list("/movie/popular", "movie"),
    list("/tv/popular", "tv"),
  ]);

  const pool = [...trending, ...popularMovies, ...popularTv];
  const seenBackdrop = new Set<string>();
  const seenPoster = new Set<string>();

  const backdrops: { title: string; backdrop: string }[] = [];
  const posters: { title: string; poster: string }[] = [];

  for (const item of pool) {
    if (item.backdrop && !seenBackdrop.has(item.backdrop) && backdrops.length < 10) {
      seenBackdrop.add(item.backdrop);
      backdrops.push({ title: item.title, backdrop: item.backdrop });
    }
    if (item.poster && !seenPoster.has(item.poster) && posters.length < 24) {
      seenPoster.add(item.poster);
      posters.push({ title: item.title, poster: item.poster });
    }
  }

  return { backdrops, posters };
}

export function formatRuntime(minutes: number | null) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m} min`;
  return `${h} h ${m.toString().padStart(2, "0")} min`;
}
