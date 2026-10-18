import { createEmbedProvider } from './BaseEmbedProvider';

/**
 * VidCore embed provider (https://vidcore.io). Standard iframe embed:
 *   movies: https://vidcore.io/movie/{id}
 *   tv:     https://vidcore.io/tv/{id}/{season}/{episode}
 * Autoplay and resume are added as query params by `buildEmbedUrl`.
 */
export const vidCoreProvider = createEmbedProvider({
  id: 'vidcore',
  name: 'VidCore',
  movieTemplate: 'https://vidcore.io/movie/{id}',
  tvTemplate: 'https://vidcore.io/tv/{id}/{season}/{episode}',
});
