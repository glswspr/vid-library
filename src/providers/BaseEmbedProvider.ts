import type { VideoProvider, EmbedOptions } from './types';
import type { PlayerCapabilities, ProviderId } from '../types';

/**
 * Shared embed-URL builder used by all iframe-based providers.
 * Each provider differs only in its base embed domain and provider ID.
 */
export function buildEmbedUrl(
  baseUrlTemplate: string,
  options: EmbedOptions,
): string {
  const { id, season = 1, episode = 1, resumeAt, autoplay = false } = options;

  // Replace placeholders in the template
  let url = baseUrlTemplate
    .replace('{id}', id)
    .replace('{season}', String(season))
    .replace('{episode}', String(episode));

  const params = new URLSearchParams();

  if (resumeAt && resumeAt > 5) {
    params.set('resumeAt', Math.floor(resumeAt).toString());
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
 * Creates a provider instance from a config object.
 * All iframe providers share identical logic; only the identity differs.
 */
export function createEmbedProvider(config: {
  id: ProviderId;
  name: string;
  movieTemplate: string;
  tvTemplate: string;
}): VideoProvider {
  return {
    id: config.id,
    name: config.name,

    getEmbedUrl(options: EmbedOptions): string {
      const template = options.type === 'movie'
        ? config.movieTemplate
        : config.tvTemplate;
      return buildEmbedUrl(template, options);
    },

    getCapabilities(): PlayerCapabilities {
      return {
        supportsSubtitles: true,
        supportsProgress: true,
        supportsAutoplayNext: false,
      };
    },
  };
}
