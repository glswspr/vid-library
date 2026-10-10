import type { VideoProvider, EmbedOptions } from './types';
import type { PlayerCapabilities, ProviderId } from '../types';
import { resolveTmdbId } from './tmdbId';

/**
 * Mapple provider (https://mappletv.uk, redirects to mapple.fun). Watch URLs:
 *   movies: https://mappletv.uk/watch/movie/{tmdbId}
 *   tv:     https://mappletv.uk/watch/tv/{tmdbId}/{season}/{episode}
 * Requires a numeric TMDB id, so IMDB ids are resolved via the TMDB API
 * (same requirement as Videoasy and VidZee).
 */
function buildMappleUrl(options: EmbedOptions): string | Promise<string> {
  const { id, type, season = 1, episode = 1 } = options;

  // Numeric (TMDB) id — build synchronously.
  if (/^\d+$/.test(id)) return buildUrl(id);

  // IMDB id — resolve the numeric TMDB id asynchronously.
  return resolveTmdbId(id).then((tmdbId) => {
    if (!tmdbId) {
      console.warn(`[Mapple] Could not resolve TMDB ID for ${id}, using raw id`);
      return buildUrl(id);
    }
    return buildUrl(tmdbId);
  });

  function buildUrl(tmdbId: string): string {
    return type === 'movie'
      ? `https://mappletv.uk/watch/movie/${tmdbId}`
      : `https://mappletv.uk/watch/tv/${tmdbId}/${season}/${episode}`;
  }
}

export const mappleProvider: VideoProvider = {
  id: 'mapple' as ProviderId,
  name: 'Mapple',
  getEmbedUrl: buildMappleUrl,
  getCapabilities(): PlayerCapabilities {
    return { supportsSubtitles: true, supportsProgress: true, supportsAutoplayNext: false };
  },
};
