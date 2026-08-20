import { createEmbedProvider } from './BaseEmbedProvider';

export const vidApiProvider = createEmbedProvider({
  id: 'vidapi',
  name: 'VidAPI',
  movieTemplate: 'https://vaplayer.ru/embed/movie/{id}',
  tvTemplate: 'https://vaplayer.ru/embed/tv/{id}/{season}/{episode}',
});
