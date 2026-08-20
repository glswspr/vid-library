import type { MediaItem, Episode, Season } from '../types';
import { EMBED2_BASE, TMDB_API_KEY, FALLBACK_TMDB_API_KEY } from './config';
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

export async function fetchTrendingMovies(page: number = 1): Promise<MediaItem[]> {
  const data = await fetch2embed<Embed2TrendingResponse>(`/trending?page=${page}`);
  let items = (data?.results ?? [])
    .map((item) => mapTrendingItem(item, 'movie'))
    .filter(Boolean) as MediaItem[];
  if (items.length > 0) items = await enrichWithTmdbRatings(items, 'movie');
  if (items.length > 0) return items;
  return fetchTrendingTmdb('movie');
}

export async function fetchTrendingTVShows(page: number = 1): Promise<MediaItem[]> {
  const data = await fetch2embed<Embed2TrendingResponse>(`/trendingtv?page=${page}`);
  let items = (data?.results ?? [])
    .map((item) => mapTrendingItem(item, 'tv'))
    .filter(Boolean) as MediaItem[];
  if (items.length > 0) items = await enrichWithTmdbRatings(items, 'tv');
  if (items.length > 0) return items;
  return fetchTrendingTmdb('tv');
}

/** Map a TMDB search/trending/similar result into a MediaItem (numeric TMDB id). */
function mapTmdbResult(it: any, type: 'movie' | 'tv'): MediaItem {
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
  if (!tmdbKey) return [];
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/trending/${type}/week?api_key=${tmdbKey}`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).slice(0, 20).map((it: any) => mapTmdbResult(it, type));
  } catch (e) {
    console.warn('TMDB trending failed:', e);
    return [];
  }
}

async function enrichWithTmdbRatings(items: MediaItem[], type: 'movie' | 'tv'): Promise<MediaItem[]> {
  const key = TMDB_API_KEY || FALLBACK_TMDB_API_KEY;
  if (!key || items.length === 0) return items;

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
  if (!tmdbKey) return [];
  try {
    // If we were handed an IMDb id, resolve it to a numeric TMDB id first.
    const tmdbId = id.startsWith('tt')
      ? (await resolveTmdbFromImdb(id, type))?.id
      : id;
    if (!tmdbId) return [];
    const res = await fetch(
      `https://api.themoviedb.org/3/${type}/${tmdbId}/similar?api_key=${tmdbKey}`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).slice(0, 20).map((it: any) => mapTmdbResult(it, type));
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
export async function fetchTmdbTVEpisodes(imdbId: string): Promise<Season[] | null> {
  const tmdbKey = TMDB_API_KEY || FALLBACK_TMDB_API_KEY;
  if (!tmdbKey) return null;
  try {
    const tmdbId = (await resolveTmdbFromImdb(imdbId, 'tv'))?.id;
    if (!tmdbId) return null;

    // Season metadata (season_number + episode_count per season)
    const detailRes = await fetch(
      `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${tmdbKey}`,
    );
    if (!detailRes.ok) return null;
    const detail = await detailRes.json();
    const seasonMeta: { season_number: number; episode_count: number }[] = (
      detail?.seasons ?? []
    ).filter((s: any) => s.season_number > 0);
    if (seasonMeta.length === 0) return null;

    const seasons: Season[] = [];
    for (const meta of seasonMeta) {
      const seasonNumber = meta.season_number;

      // Try to grab the real episode list for this season (titles/overviews)
      let episodes: Episode[] | null = null;
      try {
        const epRes = await fetch(
          `https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}?api_key=${tmdbKey}`,
        );
        if (epRes.ok) {
          const epData = await epRes.json();
          const list = epData?.episodes ?? [];
          if (list.length > 0) {
            episodes = list.map((ep: any) => ({
              seasonNumber: ep.season_number ?? seasonNumber,
              episodeNumber: ep.episode_number,
              title: ep.name || `Episode ${ep.episode_number}`,
              airDate: ep.air_date || undefined,
              overview: ep.overview || undefined,
            }));
          }
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
