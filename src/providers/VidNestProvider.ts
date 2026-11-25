import { createEmbedProvider } from './BaseEmbedProvider';

/**
 * VidNest (https://vidnest.pro). TMDB or IMDB ids; `t` is its start-at
 * parameter and lands on the right second. Verified playing movies and TV,
 * with resume.
 */
export const vidNestProvider = createEmbedProvider({
  id: 'vidnest',
  name: 'VidNest',
  movieTemplate: 'https://vidnest.pro/movie/{id}',
  tvTemplate: 'https://vidnest.pro/tv/{id}/{season}/{episode}',
  resumeParam: 't',
});
