import { createEmbedProvider } from './BaseEmbedProvider';

/**
 * VidCore (https://vidcore.io). Verified playing movies and TV on the `.io`
 * domain, which the earlier sweep had recorded as a bot-blocked host: the 403
 * was on a bare HEAD request, while a real browser frame loads and plays.
 * Some titles answer "(555) OOPS! SOMETHING WENT WRONG" instead of a stream,
 * so this server is not first in the order. The `.org` domain also works
 * (`/embed/movie/{id}`) and is kept as the fallback host.
 */
export const vidCoreProvider = createEmbedProvider({
  id: 'vidcore',
  name: 'VidCore',
  movieTemplate: 'https://vidcore.io/movie/{id}',
  tvTemplate: 'https://vidcore.io/tv/{id}/{season}/{episode}',
  resumeParam: null,
});
