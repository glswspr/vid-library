import { createEmbedProvider } from './BaseEmbedProvider';

/**
 * 111Movies (https://111movies.net). The domain redirects straight to its
 * player (player.vidmario.net) and resolves the title by TMDB id:
 *   movies: https://111movies.net/movie/{tmdbId}
 *   tv:     https://111movies.net/tv/{tmdbId}/{season}/{episode}
 * Verified playing movies and TV. The inner player sometimes shows a Cloudflare
 * check first, which a viewer passes in one click; the frame never reports an
 * error for it, so the app's error path is not the one that matters here.
 */
export const m111Provider = createEmbedProvider({
  id: 'm111',
  name: '111Movies',
  movieTemplate: 'https://111movies.net/movie/{id}',
  tvTemplate: 'https://111movies.net/tv/{id}/{season}/{episode}',
  resumeParam: null,
});
