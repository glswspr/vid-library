import { resolvePosterUrl, fetchTmdbRating, fetchTmdbGenre } from '../services/metadata';

// In-memory caches so repeated list renders don't hammer TMDB's rate limits.
const cache = new Map<string, string | undefined>();
const inflight = new Map<string, Promise<string | undefined>>();

/**
 * Resolve a poster URL for an IMDb ID (CORS-friendly TMDB lookup), memoized
 * per session. Returns `undefined` if no poster can be found.
 */
export async function getPosterUrl(
  imdbId: string,
  type: 'movie' | 'tv',
): Promise<string | undefined> {
  if (!imdbId) return undefined;
  if (cache.has(imdbId)) return cache.get(imdbId);
  const existing = inflight.get(imdbId);
  if (existing) return existing;

  const p = resolvePosterUrl(imdbId, type)
    .then((url) => {
      cache.set(imdbId, url);
      inflight.delete(imdbId);
      return url;
    })
    .catch(() => {
      cache.set(imdbId, undefined);
      inflight.delete(imdbId);
      return undefined;
    });
  inflight.set(imdbId, p);
  return p;
}

const ratingCache = new Map<string, string | undefined>();
const ratingInflight = new Map<string, Promise<string | undefined>>();

/**
 * Resolve a TMDB rating for an IMDb ID, memoized per session.
 */
export async function getRatingUrl(
  imdbId: string,
  type: 'movie' | 'tv',
): Promise<string | undefined> {
  if (!imdbId) return undefined;
  if (ratingCache.has(imdbId)) return ratingCache.get(imdbId);
  const existing = ratingInflight.get(imdbId);
  if (existing) return existing;

  const p = fetchTmdbRating(imdbId, type)
    .then((rating) => {
      ratingCache.set(imdbId, rating);
      ratingInflight.delete(imdbId);
      return rating;
    })
    .catch(() => {
      ratingCache.set(imdbId, undefined);
      ratingInflight.delete(imdbId);
      return undefined;
    });
  ratingInflight.set(imdbId, p);
  return p;
}

const genreCache = new Map<string, string | undefined>();
const genreInflight = new Map<string, Promise<string | undefined>>();

/**
 * Resolve a comma-separated genre list for an IMDb ID, memoized per session.
 */
export async function getGenre(
  imdbId: string,
  type: 'movie' | 'tv',
): Promise<string | undefined> {
  if (!imdbId) return undefined;
  if (genreCache.has(imdbId)) return genreCache.get(imdbId);
  const existing = genreInflight.get(imdbId);
  if (existing) return existing;

  const p = fetchTmdbGenre(imdbId, type)
    .then((genre) => {
      genreCache.set(imdbId, genre);
      genreInflight.delete(imdbId);
      return genre;
    })
    .catch(() => {
      genreCache.set(imdbId, undefined);
      genreInflight.delete(imdbId);
      return undefined;
    });
  genreInflight.set(imdbId, p);
  return p;
}
