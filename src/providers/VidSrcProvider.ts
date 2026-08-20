import { createEmbedProvider } from './BaseEmbedProvider';

export const vidSrcProvider = createEmbedProvider({
  id: 'vidsrc',
  name: 'VidSrc',
  movieTemplate: 'https://vidsrc.to/embed/movie/{id}',
  tvTemplate: 'https://vidsrc.to/embed/tv/{id}/{season}/{episode}',
});
