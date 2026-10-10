import type { VideoProvider, EmbedOptions } from './types';
import type { PlayerCapabilities, ProviderId } from '../types';
import { resolveTmdbId } from './tmdbId';

/**
 * StreamXTV own player (https://embed.streamxtv.tech, branded frameXTV). It is
 * the first-party player behind the streamxtv.tech site:
 *   movies: https://embed.streamxtv.tech/embed/{tmdbId}
 *   tv:     https://embed.streamxtv.tech/embed/{tmdbId}/{season}/{episode}
 * Verified fetching real HLS playlists for both movies and TV. Requires a
 * numeric TMDB id, so IMDB ids are resolved via the TMDB API.
 */
function buildStreamXUrl(options: EmbedOptions): string | Promise<string> {
  const { id, type, season = 1, episode = 1 } = options;

  if (/^\d+$/.test(id)) return buildUrl(id);

  return resolveTmdbId(id).then((tmdbId) => {
    if (!tmdbId) {
      console.warn(`[StreamX] Could not resolve TMDB ID for ${id}, using raw id`);
      return buildUrl(id);
    }
    return buildUrl(tmdbId);
  });

  function buildUrl(tmdbId: string): string {
    return type === 'movie'
      ? `https://embed.streamxtv.tech/embed/${tmdbId}`
      : `https://embed.streamxtv.tech/embed/${tmdbId}/${season}/${episode}`;
  }
}

export const streamXProvider: VideoProvider = {
  id: 'streamx' as ProviderId,
  name: 'StreamX',
  getEmbedUrl: buildStreamXUrl,
  getCapabilities(): PlayerCapabilities {
    return { supportsSubtitles: true, supportsProgress: true, supportsAutoplayNext: false };
  },
};
