import { createEmbedProvider } from './BaseEmbedProvider';

export const vidRockProvider = createEmbedProvider({
  id: 'vidrock',
  name: 'VidRock',
  movieTemplate: 'https://vidrock.ru/embed/movie/{id}',
  tvTemplate: 'https://vidrock.ru/embed/tv/{id}/{season}/{episode}',
});
