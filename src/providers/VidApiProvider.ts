import { createEmbedProvider } from './BaseEmbedProvider';

/**
 * VidAPI (https://vaplayer.ru). Verified playing movies and TV, but only while
 * the session is already warm: the embed frame hands off to a per-session
 * host (nextgencloudfabric.com in the verified run) and the handoff fails on a
 * cold first visit. In practice it plays after the site has been opened once,
 * which is what the app's player does on a second click or a reload.
 */
export const vidApiProvider = createEmbedProvider({
  id: 'vidapi',
  name: 'VidAPI',
  movieTemplate: 'https://vaplayer.ru/embed/movie/{id}',
  tvTemplate: 'https://vaplayer.ru/embed/tv/{id}/{season}/{episode}',
  resumeParam: null,
});
