import { createEmbedProvider } from './BaseEmbedProvider';

/**
 * VidSrc (https://vidsrc.to). Verified playing movies and TV with subtitles.
 * The frame passes through vidsrc.sh and on to the CDN host, so an error that
 * appears here is usually the inner frame's, not VidSrc's.
 */
export const vidSrcProvider = createEmbedProvider({
  id: 'vidsrc',
  name: 'VidSrc',
  movieTemplate: 'https://vidsrc.to/embed/movie/{id}',
  tvTemplate: 'https://vidsrc.to/embed/tv/{id}/{season}/{episode}',
  resumeParam: null,
});
