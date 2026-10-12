import type { MediaItem, Episode, Season } from '../types';
import { EMBED2_BASE, TMDB_API_KEY, FALLBACK_TMDB_API_KEY, canUseTmdb, tmdbFetchJson } from './config';
import { resolveTmdbFromImdb, fetchTmdbRating } from './metadata';

interface Embed2TrendingItem {
  title?: string;
  name?: string; // TV items use `name` instead of `title`
  imdb_id?: string;
  year?: string;
  first_air_year?: string; // TV items use `first_air_year` instead of `year`
  poster?: string;
  quality?: string;
  type?: string;
}

interface Embed2MovieDetail {
  title?: string;
  year?: string;
  poster?: string;
  rating?: string;
  genre?: string;
  plot?: string;
  duration?: string;
  cast?: string[];
  embed_imdb?: string;
  embed_tmdb?: string;
}

interface Embed2ShowDetail extends Embed2MovieDetail {
  seasons?: number;
  episodes?: number;
}

interface Embed2SeasonEpisode {
  // 2embed's /season endpoint proxies TMDB, so episodes use TMDB's field
  // names (episode_number/name). Keep the legacy 2embed names (episode/title)
  // as a fallback in case the endpoint format changes back.
  episode_number?: number;
  episode?: number;
  season_number?: number;
  season?: number;
  name?: string;
  title?: string;
  air_date?: string;
  overview?: string;
}

interface Embed2SeasonResponse {
  success?: boolean;
  episodes?: Embed2SeasonEpisode[];
}

interface Embed2DetailResponse {
  success?: boolean;
  movie?: Embed2MovieDetail;
  tv?: Embed2ShowDetail;
}

interface Embed2TrendingResponse {
  success?: boolean;
  results?: Embed2TrendingItem[];
}

async function fetch2embed<T>(endpoint: string): Promise<T | null> {
  try {
    const res = await fetch(`${EMBED2_BASE}${endpoint}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    return data as T;
  } catch (e) {
    console.warn(`2embed fetch failed: ${endpoint}`, e);
    return null;
  }
}

function mapTrendingItem(item: Embed2TrendingItem, type: 'movie' | 'tv'): MediaItem | null {
  if (!item.imdb_id || !item.imdb_id.startsWith('tt')) return null;
  return {
    id: item.imdb_id,
    imdbId: item.imdb_id,
    title: item.title || item.name || 'Untitled',
    year: item.year || item.first_air_year || undefined,
    posterUrl: item.poster || undefined,
    type,
  };
}

export async function fetchTrendingMovies(page: number = 1, englishOnly: boolean = true): Promise<MediaItem[]> {
  const discover = await fetchDiscoverTmdb('movie', englishOnly, page);
  if (discover.length > 0) return discover;

  const data = await fetch2embed<Embed2TrendingResponse>(`/trending?page=${page}`);
  let items = (data?.results ?? [])
    .map((item) => mapTrendingItem(item, 'movie'))
    .filter(Boolean) as MediaItem[];
  if (items.length > 0) items = await enrichWithTmdbRatings(items, 'movie');
  if (items.length > 0) return items;
  return fetchTrendingTmdb('movie');
}

export async function fetchTrendingTVShows(page: number = 1, englishOnly: boolean = true): Promise<MediaItem[]> {
  const discover = await fetchDiscoverTmdb('tv', englishOnly, page);
  if (discover.length > 0) return discover;

  const data = await fetch2embed<Embed2TrendingResponse>(`/trendingtv?page=${page}`);
  let items = (data?.results ?? [])
    .map((item) => mapTrendingItem(item, 'tv'))
    .filter(Boolean) as MediaItem[];
  if (items.length > 0) items = await enrichWithTmdbRatings(items, 'tv');
  if (items.length > 0) return items;
  return fetchTrendingTmdb('tv');
}

// Quality gates for the home rows: TMDB discover, popularity-sorted but only
// well-voted, well-rated, recent titles — keeps the "trending" feel without
// the scraped-catalog fillers. TV uses lower thresholds because shows
// accumulate fewer votes than movies.
const DISCOVER_MIN_RATING: Record<'movie' | 'tv', number> = { movie: 6.8, tv: 7.0 };
const DISCOVER_MIN_VOTES: Record<'movie' | 'tv', number> = { movie: 1000, tv: 300 };
const DISCOVER_FRESHNESS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

async function fetchDiscoverTmdb(
  type: 'movie' | 'tv',
  englishOnly: boolean,
  page: number = 1,
): Promise<MediaItem[]> {
  const tmdbKey = TMDB_API_KEY || FALLBACK_TMDB_API_KEY;
  if (!canUseTmdb(tmdbKey)) return [];
  try {
    const since = new Date(Date.now() - DISCOVER_FRESHNESS_MS).toISOString().slice(0, 10);
    const dateParam = type === 'movie' ? 'primary_release_date' : 'first_air_date';
    const params = new URLSearchParams({
      sort_by: 'popularity.desc',
      page: String(page),
      'vote_average.gte': String(DISCOVER_MIN_RATING[type]),
      'vote_count.gte': String(DISCOVER_MIN_VOTES[type]),
      [`${dateParam}.gte`]: since,
    });
    if (tmdbKey) params.set('api_key', tmdbKey);
    if (englishOnly) params.set('with_original_language', 'en');

    const data = await tmdbFetchJson(`/discover/${type}?${params.toString()}`, tmdbKey);
    if (!data || typeof data !== 'object' || !('results' in data)) return [];
    return ((data as { results?: unknown[] }).results ?? []).slice(0, 20)
      .map((it) => mapTmdbResult(it, type));
  } catch (e) {
    console.warn('TMDB discover failed:', e);
    return [];
  }
}

/** Map a TMDB search/trending/similar result into a MediaItem (numeric TMDB id). */
export function mapTmdbResult(it: any, type: 'movie' | 'tv'): MediaItem {
  const id = String(it.id);
  return {
    id,
    tmdbId: id,
    title: it.title || it.name || 'Untitled',
    year: (it.release_date || it.first_air_date || '').substring(0, 4) || undefined,
    posterUrl: it.poster_path ? `https://image.tmdb.org/t/p/w342${it.poster_path}` : undefined,
    rating: it.vote_average ? it.vote_average.toFixed(1) : undefined,
    type,
  };
}

/** TMDB trending fallback (returns numeric TMDB ids — the detail pages resolve those). */
async function fetchTrendingTmdb(type: 'movie' | 'tv'): Promise<MediaItem[]> {
  const tmdbKey = TMDB_API_KEY || FALLBACK_TMDB_API_KEY;
  if (!canUseTmdb(tmdbKey)) return [];
  try {
    const data = await tmdbFetchJson(`/trending/${type}/week`, tmdbKey);
    if (!data || typeof data !== 'object' || !('results' in data)) return [];
    return ((data as { results?: unknown[] }).results ?? []).slice(0, 20)
      .map((it) => mapTmdbResult(it, type));
  } catch (e) {
    console.warn('TMDB trending failed:', e);
    return [];
  }
}

async function enrichWithTmdbRatings(items: MediaItem[], type: 'movie' | 'tv'): Promise<MediaItem[]> {
  const key = TMDB_API_KEY || FALLBACK_TMDB_API_KEY;
  if (!canUseTmdb(key) || items.length === 0) return items;

  const results = await Promise.allSettled(
    items.map(async (item) => {
      if (item.rating) return item;
      const rating = await fetchTmdbRating(item.imdbId || item.id, type);
      return rating ? { ...item, rating } : item;
    }),
  );

  return items.map((item, i) =>
    results[i].status === 'fulfilled' ? results[i].value : item,
  );
}

/** TMDB similar fallback — uses the numeric TMDB id directly, or resolves an IMDb id first. */
async function fetchSimilarTmdb(id: string, type: 'movie' | 'tv'): Promise<MediaItem[]> {
  const tmdbKey = TMDB_API_KEY || FALLBACK_TMDB_API_KEY;
  if (!canUseTmdb(tmdbKey)) return [];
  try {
    // If we were handed an IMDb id, resolve it to a numeric TMDB id first.
    const tmdbId = id.startsWith('tt')
      ? (await resolveTmdbFromImdb(id, type))?.id
      : id;
    if (!tmdbId) return [];
    const data = await tmdbFetchJson(`/${type}/${tmdbId}/similar`, tmdbKey);
    if (!data || typeof data !== 'object' || !('results' in data)) return [];
    return ((data as { results?: unknown[] }).results ?? []).slice(0, 20)
      .map((it) => mapTmdbResult(it, type));
  } catch (e) {
    console.warn('TMDB similar failed:', e);
    return [];
  }
}

export async function fetchMovieDetail(imdbId: string): Promise<MediaItem | null> {
  const data = await fetch2embed<Embed2DetailResponse>(`/movie?imdb_id=${imdbId}`);
  const movie = data?.movie;
  if (!movie) return null;

  return {
    id: imdbId,
    imdbId,
    title: movie.title || imdbId,
    year: movie.year || undefined,
    posterUrl: movie.poster || undefined,
    rating: movie.rating || undefined,
    genre: movie.genre || undefined,
    type: 'movie',
    description: movie.plot || undefined,
    duration: movie.duration || undefined,
    cast: movie.cast || undefined,
  };
}

export async function fetchShowDetail(imdbId: string): Promise<MediaItem | null> {
  const data = await fetch2embed<Embed2DetailResponse>(`/tv?imdb_id=${imdbId}`);
  const show = data?.tv;
  if (!show) return null;

  return {
    id: imdbId,
    imdbId,
    title: show.title || imdbId,
    year: show.year || undefined,
    posterUrl: show.poster || undefined,
    rating: show.rating || undefined,
    genre: show.genre || undefined,
    type: 'tv',
    description: show.plot || undefined,
    seasonsCount: show.seasons || undefined,
    duration: show.duration || undefined,
    cast: show.cast || undefined,
  };
}

export async function fetchSeasonEpisodes(
  imdbId: string,
  seasonNumber: number,
): Promise<Episode[]> {
  const data = await fetch2embed<Embed2SeasonResponse>(
    `/season?imdb_id=${imdbId}&season=${seasonNumber}`,
  );
  if (!data?.episodes?.length) return [];

  return data.episodes.map((ep) => {
    const episodeNumber = ep.episode_number ?? ep.episode ?? 1;
    return {
      seasonNumber: ep.season_number ?? ep.season ?? seasonNumber,
      episodeNumber,
      title: ep.name || ep.title || `Episode ${episodeNumber}`,
      airDate: ep.air_date || undefined,
      overview: ep.overview || undefined,
    };
  });
}

/**
 * TMDB fallback for real per-season episode data.
 * Used when 2embed is unreachable/CORS-blocked so episode counts (e.g.
 * Friends S2 = 24) aren't replaced with a hardcoded placeholder.
 * Resolves the IMDb id to a TMDB id, then pulls each season's real episode
 * list (falling back to TMDB's per-season episode_count when the list
 * fetch fails). Returns null when TMDB can't resolve the title.
 */
/**
 * Fetch per-season episode lists from TMDB by TMDB id. Each episode carries an
 * air_date (ISO YYYY-MM-DD) used to compute the "Soon"/disabled state in the
 * episode grid.
 */
export async function fetchTmdbSeasonsByTmdbId(tmdbId: string): Promise<Season[] | null> {
  const tmdbKey = TMDB_API_KEY || FALLBACK_TMDB_API_KEY;
  if (!canUseTmdb(tmdbKey)) return null;
  try {
    const detail = await tmdbFetchJson(`/tv/${tmdbId}`, tmdbKey) as { seasons?: { season_number: number; episode_count: number }[] } | null;
    const seasonMeta: { season_number: number; episode_count: number }[] = (
      detail?.seasons ?? []
    ).filter((s) => s.season_number > 0);
    if (seasonMeta.length === 0) return null;

    const seasons: Season[] = [];
    for (const meta of seasonMeta) {
      const seasonNumber = meta.season_number;

      // Try to grab the real episode list for this season (titles/overviews/air dates)
      let episodes: Episode[] | null = null;
      try {
        const epData = await tmdbFetchJson(`/tv/${tmdbId}/season/${seasonNumber}`, tmdbKey) as
          { episodes?: { season_number?: number; episode_number: number; name?: string; air_date?: string; overview?: string; still_path?: string }[] } | null;
        const list = epData?.episodes ?? [];
        if (list.length > 0) {
          episodes = list.map((ep) => ({
            seasonNumber: ep.season_number ?? seasonNumber,
            episodeNumber: ep.episode_number,
            title: ep.name || `Episode ${ep.episode_number}`,
            airDate: ep.air_date || undefined,
            overview: ep.overview || undefined,
            stillPath: ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : undefined,
          }));
        }
      } catch {
        // fall through to count-based placeholders
      }

      const episodeCount = episodes?.length ?? meta.episode_count ?? 0;
      if (episodeCount === 0) continue;

      seasons.push({
        seasonNumber,
        episodeCount,
        episodes:
          episodes ??
          Array.from({ length: episodeCount }, (_, i) => ({
            seasonNumber,
            episodeNumber: i + 1,
            title: `Episode ${i + 1}`,
          })),
      });
    }

    return seasons.length > 0 ? seasons : null;
  } catch (e) {
    console.warn('TMDB TV episodes fetch failed:', e);
    return null;
  }
}

export async function fetchTmdbTVEpisodes(imdbId: string): Promise<Season[] | null> {
  const tmdbId = (await resolveTmdbFromImdb(imdbId, 'tv'))?.id;
  if (!tmdbId) return null;
  return fetchTmdbSeasonsByTmdbId(tmdbId);
}

export async function fetchSimilarMovies(
  imdbId: string,
  page: number = 1,
): Promise<MediaItem[]> {
  const data = await fetch2embed<Embed2TrendingResponse>(
    `/similar?imdb_id=${imdbId}&page=${page}`,
  );
  let items = (data?.results ?? [])
    .map((item) => mapTrendingItem(item, 'movie'))
    .filter(Boolean) as MediaItem[];
  if (items.length > 0) items = await enrichWithTmdbRatings(items, 'movie');
  if (items.length > 0) return items;
  return fetchSimilarTmdb(imdbId, 'movie');
}

export async function fetchSimilarTVShows(
  imdbId: string,
  page: number = 1,
): Promise<MediaItem[]> {
  const data = await fetch2embed<Embed2TrendingResponse>(
    `/similartv?imdb_id=${imdbId}&page=${page}`,
  );
  let items = (data?.results ?? [])
    .map((item) => mapTrendingItem(item, 'tv'))
    .filter(Boolean) as MediaItem[];
  if (items.length > 0) items = await enrichWithTmdbRatings(items, 'tv');
  if (items.length > 0) return items;
  return fetchSimilarTmdb(imdbId, 'tv');
}
