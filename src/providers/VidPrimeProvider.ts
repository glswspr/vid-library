import { createEmbedProvider } from './BaseEmbedProvider';

/**
 * VidPrime (https://vidprime.top). TMDB ids only, and `startAt` lands on the
 * right second. Verified playing movies and TV, with resume.
 */
export const vidPrimeProvider = createEmbedProvider({
  id: 'vidprime',
  name: 'VidPrime',
  movieTemplate: 'https://vidprime.top/movie/{id}',
  tvTemplate: 'https://vidprime.top/tv/{id}/{season}/{episode}',
  resumeParam: 'startAt',
});
