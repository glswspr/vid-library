import type { VideoProvider, EmbedOptions } from './types';
import type { PlayerCapabilities, ProviderId } from '../types';
import { resolveTmdbId } from './tmdbId';

/**
 * 111Movies provider (https://111movies.net). The domain redirects straight to
 * its player at https://player.vidlove.cc, which resolves the title by TMDB id:
 *   movies: https://111movies.net/movie/{tmdbId}
 *   tv:     https://111movies.net/tv/{tmdbId}/{season}/{episode}
 * Verified playing (movie + TV, up to 1080p). Requires a numeric TMDB id, so
 * IMDB ids are resolved via the TMDB API.
 */
function build111MoviesUrl(options: EmbedOptions): string | Promise<string> {
  const { id, type, season = 1, episode = 1 } = options;

  if (/^\d+$/.test(id)) return buildUrl(id);

  return resolveTmdbId(id).then((tmdbId) => {
    if (!tmdbId) {
      console.warn(`[111Movies] Could not resolve TMDB ID for ${id}, using raw id`);
      return buildUrl(id);
    }
    return buildUrl(tmdbId);
  });

  function buildUrl(tmdbId: string): string {
    return type === 'movie'
      ? `https://111movies.net/movie/${tmdbId}`
      : `https://111movies.net/tv/${tmdbId}/${season}/${episode}`;
  }
}

export const m111Provider: VideoProvider = {
  id: 'm111' as ProviderId,
  name: '111Movies',
  getEmbedUrl: build111MoviesUrl,
  getCapabilities(): PlayerCapabilities {
    return { supportsSubtitles: true, supportsProgress: true, supportsAutoplayNext: false };
  },
};
