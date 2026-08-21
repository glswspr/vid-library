import type { VideoProvider, EmbedOptions } from './types';
import type { PlayerCapabilities, ProviderId } from '../types';
import { resolveTmdbId } from './tmdbId';

/**
 * VidZee embed provider (https://vidzee.wtf). Docs embed format:
 *   movies: https://player.vidzee.wtf/embed/movie/{tmdb_id}
 *   tv:     https://player.vidzee.wtf/embed/tv/{tmdb_id}/{season}/{episode}
 * Requires a numeric TMDB id, so IMDB ids are resolved via the TMDB API.
 */
function buildVidZeeUrl(options: EmbedOptions): string | Promise<string> {
  const { id, type, season = 1, episode = 1, resumeAt } = options;

  // Numeric (TMDB) id — build synchronously.
  if (/^\d+$/.test(id)) return buildUrl(id);

  // IMDB id — resolve the numeric TMDB id asynchronously.
  return resolveTmdbId(id).then((tmdbId) => {
    if (!tmdbId) {
      console.warn(`[VidZee] Could not resolve TMDB ID for ${id}, using raw id`);
      return buildUrl(id);
    }
    return buildUrl(tmdbId);
  });

  function buildUrl(tmdbId: string): string {
    const baseUrl =
      type === 'movie'
        ? `https://player.vidzee.wtf/embed/movie/${tmdbId}`
        : `https://player.vidzee.wtf/embed/tv/${tmdbId}/${season}/${episode}`;
    // VidZee doesn't document a resume param; pass resumeAt via a generic
    // query param as a best-effort (ignored if unsupported).
    const params = new URLSearchParams();
    if (resumeAt && resumeAt > 5) {
      params.set('startTime', Math.floor(resumeAt).toString());
    }
    const qs = params.toString();
    return qs ? `${baseUrl}?${qs}` : baseUrl;
  }
}

export const vidZeeProvider: VideoProvider = {
  id: 'vidzee' as ProviderId,
  name: 'VidZee',
  getEmbedUrl: buildVidZeeUrl,
  getCapabilities(): PlayerCapabilities {
    return { supportsSubtitles: true, supportsProgress: true, supportsAutoplayNext: false };
  },
};
