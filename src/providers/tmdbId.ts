import { TMDB_API_KEY, FALLBACK_TMDB_API_KEY } from '../services/config';

const imdbToTmdbCache = new Map<string, string | null>();

/**
 * Resolve an IMDB id (tt...) to a numeric TMDB id. Already-numeric ids pass
 * through unchanged. Used by providers that only accept numeric TMDB ids
 * (Peachify, Videoasy).
 */
export async function resolveTmdbId(id: string): Promise<string | null> {
  // Already numeric — use directly.
  if (/^\d+$/.test(id)) return id;

  // Must be an IMDB ID (tt-prefix) to attempt conversion.
  if (!id.startsWith('tt')) return null;

  const cached = imdbToTmdbCache.get(id);
  if (cached !== undefined) return cached;

  const apiKey = TMDB_API_KEY || FALLBACK_TMDB_API_KEY;
  if (!apiKey) {
    imdbToTmdbCache.set(id, null);
    return null;
  }

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/find/${id}?api_key=${apiKey}&external_source=imdb_id`,
    );
    if (!res.ok) {
      imdbToTmdbCache.set(id, null);
      return null;
    }
    const data = await res.json();
    const tmdbId =
      data?.movie_results?.[0]?.id ??
      data?.tv_results?.[0]?.id ??
      data?.tv_episode_results?.[0]?.id ??
      null;

    const result = tmdbId ? String(tmdbId) : null;
    imdbToTmdbCache.set(id, result);
    return result;
  } catch {
    imdbToTmdbCache.set(id, null);
    return null;
  }
}
