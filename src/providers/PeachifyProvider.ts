import { createEmbedProvider } from './BaseEmbedProvider';

/**
 * Peachify (https://peachify.net). TMDB ids only. It documents `startAt` and
 * `autoplay` and honours neither: a resume position is confirmed playing but
 * starts at 0:00, so resume is left out rather than pretending it works.
 * Verified playing movies and TV.
 */
export const peachifyProvider = createEmbedProvider({
  id: 'peachify',
  name: 'Peachify',
  movieTemplate: 'https://peachify.net/movie/{id}',
  tvTemplate: 'https://peachify.net/tv/{id}/{season}/{episode}',
  resumeParam: null,
});
