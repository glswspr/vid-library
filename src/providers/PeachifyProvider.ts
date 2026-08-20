import type { VideoProvider, EmbedOptions } from './types';
import type { PlayerCapabilities, ProviderId } from '../types';
import { resolveTmdbId } from './tmdbId';

/**
 * Peachify provider — iframe embed on https://peachify.top.
 * Requires numeric TMDB IDs, so we convert IMDB IDs via the TMDB API.
 * (The .pro domain is dead/403; .top is the live domain used by StreamXTV.)
 */
function buildPeachifyUrl(options: EmbedOptions): string | Promise<string> {
  const { id, type, season = 1, episode = 1, resumeAt, autoplay = false, subtitle } = options;

  // If the id is already numeric (TMDB), build synchronously.
  if (/^\d+$/.test(id)) {
    return buildUrl(id);
  }

  // IMDB ID — resolve TMDB ID asynchronously.
  return resolveTmdbId(id).then((tmdbId) => {
    if (!tmdbId) {
      // Fallback: try the original id anyway (may still fail, but better than nothing).
      console.warn(`[Peachify] Could not resolve TMDB ID for ${id}, using raw id`);
      return buildUrl(id);
    }
    return buildUrl(tmdbId);
  });

  function buildUrl(tmdbId: string): string {
    const baseUrl =
      type === 'movie'
        ? `https://peachify.top/embed/movie/${tmdbId}`
        : `https://peachify.top/embed/tv/${tmdbId}/${season}/${episode}`;

    const params = new URLSearchParams();

    if (resumeAt && resumeAt > 5) {
      params.set('startAt', Math.floor(resumeAt).toString());
    }

    if (autoplay) {
      params.set('autoPlay', 'true');
    } else {
      params.set('autoPlay', 'false');
    }

    if (subtitle && subtitle !== 'off') {
      params.set('sub', subtitle === 'en' ? 'English' : subtitle);
    }

    const queryString = params.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  }
}

export const peachifyProvider: VideoProvider = {
  id: 'peachify' as ProviderId,
  name: 'Peachify',
  getEmbedUrl: buildPeachifyUrl,
  getCapabilities(): PlayerCapabilities {
    return { supportsSubtitles: true, supportsProgress: true };
  },
};
