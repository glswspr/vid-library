import { createEmbedProvider } from './BaseEmbedProvider';

/**
 * Mapple (https://mappletv.uk, redirects to mapple.fun). Verified playing
 * movies and TV. TMDB ids only.
 */
export const mappleProvider = createEmbedProvider({
  id: 'mapple',
  name: 'Mapple',
  movieTemplate: 'https://mappletv.uk/watch/movie/{id}',
  tvTemplate: 'https://mappletv.uk/watch/tv/{id}/{season}/{episode}',
  resumeParam: null,
});
