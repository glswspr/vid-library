import type { VideoProvider, EmbedOptions } from './types';
import type { PlayerCapabilities, ProviderId } from '../types';
import { resolveTmdbId } from './tmdbId';

/** Query parameter a player uses to start at a position, if it has one. */
export type ResumeParam = 'startAt' | 't';

/**
 * Build the iframe URL for one provider.
 *
 * `resumeParam` names the provider's own start-at parameter. VidCore and
 * Peachify document one but ignore it in practice, so they pass `null` and the
 * resume position is left out instead of silently doing nothing.
 */
export function buildEmbedUrl(
  baseUrlTemplate: string,
  options: EmbedOptions,
  resumeParam: ResumeParam | null = 'startAt',
): string {
  const { id, season = 1, episode = 1, resumeAt, autoplay = false } = options;

  let url = baseUrlTemplate
    .replace('{id}', id)
    .replace('{season}', String(season))
    .replace('{episode}', String(episode));

  const params = new URLSearchParams();

  if (resumeParam && resumeAt && resumeAt > 5) {
    params.set(resumeParam, Math.floor(resumeAt).toString());
  }

  if (autoplay) {
    params.set('autoplay', '1');
  }

  const queryString = params.toString();
  if (!queryString) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${queryString}`;
}

/**
 * One provider instance from a config object. Every live provider takes a
 * numeric TMDB id and shares this logic; only identity and parameters differ.
 * IMDB ids (tt1234567) are resolved through the TMDB API first.
 */
export function createEmbedProvider(config: {
  id: ProviderId;
  name: string;
  movieTemplate: string;
  tvTemplate: string;
  resumeParam?: ResumeParam | null;
}): VideoProvider {
  const resumeParam = config.resumeParam === undefined ? 'startAt' : config.resumeParam;

  return {
    id: config.id,
    name: config.name,

    getEmbedUrl(options: EmbedOptions): string | Promise<string> {
      const template = options.type === 'movie'
        ? config.movieTemplate
        : config.tvTemplate;
      return buildUrlFor(template, options);
    },

    getCapabilities(): PlayerCapabilities {
      return {
        supportsSubtitles: true,
        supportsProgress: true,
        supportsAutoplayNext: false,
      };
    },
  };

  function buildUrlFor(template: string, options: EmbedOptions): string | Promise<string> {
    if (/^\d+$/.test(options.id)) return buildEmbedUrl(template, options, resumeParam);

    return resolveTmdbId(options.id).then((tmdbId) => {
      if (!tmdbId) {
        console.warn(`[${config.name}] Could not resolve TMDB ID for ${options.id}, using raw id`);
        return buildEmbedUrl(template, { ...options, id: options.id }, resumeParam);
      }
      return buildEmbedUrl(template, { ...options, id: tmdbId }, resumeParam);
    });
  }
}
