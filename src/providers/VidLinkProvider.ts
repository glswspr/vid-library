import { createEmbedProvider } from './BaseEmbedProvider';

/**
 * VidLink (https://vidlink.pro). TMDB ids only; `startAt` is documented but
 * ignored by the player, so resume is left out. Verified playing movies and TV.
 */
export const vidLinkProvider = createEmbedProvider({
  id: 'vidlink',
  name: 'VidLink',
  movieTemplate: 'https://vidlink.pro/movie/{id}',
  tvTemplate: 'https://vidlink.pro/tv/{id}/{season}/{episode}',
  resumeParam: null,
});
