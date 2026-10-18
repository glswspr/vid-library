import { resolvePosterUrl, fetchTmdbRating, fetchTmdbGenre, fetchTitle } from '../services/metadata';

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

const titleCache = new Map<string, string | undefined>();
const titleInflight = new Map<string, Promise<string | undefined>>();

/**
 * Resolve a title for an ID (IMDB or TMDB), memoized per session.
 */
export async function getTitle(
  id: string,
  type: 'movie' | 'tv',
): Promise<string | undefined> {
  if (!id) return undefined;
  if (titleCache.has(id)) return titleCache.get(id);
  const existing = titleInflight.get(id);
  if (existing) return existing;

  const p = fetchTitle(id, type)
    .then((title) => {
      const result = title ?? undefined;
      titleCache.set(id, result);
      titleInflight.delete(id);
      return result;
    })
    .catch(() => {
      titleCache.set(id, undefined);
      titleInflight.delete(id);
      return undefined;
    });
  titleInflight.set(id, p);
  return p;
}

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
