import type { VideoProvider, EmbedOptions } from './types';
import type { PlayerCapabilities, ProviderId } from '../types';
import { resolveTmdbId } from './tmdbId';

/**
 * Videoasy embed provider — https://player.videasy.to (docs: videasy.to/docs).
 *   movies: https://player.videasy.to/movie/{tmdbId}
 *   tv:     https://player.videasy.to/tv/{tmdbId}/{season}/{episode}
 * Requires a numeric TMDB id, so IMDB ids are resolved via the TMDB API
 * (same requirement as Peachify). Resume uses the `progress` param (seconds);
 * the player posts progress via window messages.
 */
function buildVideoasyUrl(options: EmbedOptions): string | Promise<string> {
  const { id, type, season = 1, episode = 1, resumeAt } = options;

  // Numeric (TMDB) id — build synchronously.
  if (/^\d+$/.test(id)) return buildUrl(id);

  // IMDB id — resolve the numeric TMDB id asynchronously.
  return resolveTmdbId(id).then((tmdbId) => {
    if (!tmdbId) {
      // Fallback: try the original id anyway (may still fail, but better than nothing).
      console.warn(`[Videoasy] Could not resolve TMDB ID for ${id}, using raw id`);
      return buildUrl(id);
    }
    return buildUrl(tmdbId);
  });

  function buildUrl(tmdbId: string): string {
    const baseUrl =
      type === 'movie'
        ? `https://player.videasy.to/movie/${tmdbId}`
        : `https://player.videasy.to/tv/${tmdbId}/${season}/${episode}`;

    const params = new URLSearchParams();
    if (resumeAt && resumeAt > 5) {
      params.set('progress', Math.floor(resumeAt).toString());
    }
    const queryString = params.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  }
}

export const videasyProvider: VideoProvider = {
  id: 'videasy' as ProviderId,
  name: 'Videoasy',
  getEmbedUrl: buildVideoasyUrl,
  getCapabilities(): PlayerCapabilities {
    return { supportsSubtitles: true, supportsProgress: true };
  },
};
