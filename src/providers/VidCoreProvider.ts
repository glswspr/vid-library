import { createEmbedProvider } from './BaseEmbedProvider';

/**
 * VidCore embed provider (https://vidcore.io). Standard iframe embed:
 *   movies: https://vidcore.io/movie/{id}
 *   tv:     https://vidcore.io/tv/{id}/{season}/{episode}
 * Supports an `autoPlay` query param.
 */
export const vidCoreProvider = createEmbedProvider({
  id: 'vidcore',
  name: 'VidCore',
  movieTemplate: 'https://vidcore.io/movie/{id}?autoPlay=true',
  tvTemplate: 'https://vidcore.io/tv/{id}/{season}/{episode}?autoPlay=true',
});
