import { createEmbedProvider } from './BaseEmbedProvider';

/**
 * VidZee (https://player.vidzee.wtf). Verified playing movies and TV. TMDB ids
 * only. The old warning that it refuses framing no longer holds: the verified
 * frame loaded and played, with X-Frame-Options absent on the embed path.
 */
export const vidZeeProvider = createEmbedProvider({
  id: 'vidzee',
  name: 'VidZee',
  movieTemplate: 'https://player.vidzee.wtf/embed/movie/{id}',
  tvTemplate: 'https://player.vidzee.wtf/embed/tv/{id}/{season}/{episode}',
  resumeParam: null,
});
