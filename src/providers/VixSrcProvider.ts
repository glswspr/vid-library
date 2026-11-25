import { createEmbedProvider } from './BaseEmbedProvider';

/**
 * VixSrc (https://vixsrc.to). Accepts TMDB or IMDB ids; `startAt` lands on the
 * right second. Verified playing movies and TV, with resume.
 */
export const vixSrcProvider = createEmbedProvider({
  id: 'vixsrc',
  name: 'VixSrc',
  movieTemplate: 'https://vixsrc.to/movie/{id}',
  tvTemplate: 'https://vixsrc.to/tv/{id}/{season}/{episode}',
  resumeParam: 'startAt',
});
