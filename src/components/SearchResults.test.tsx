import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { SearchResults } from './SearchResults';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

describe('SearchResults person rendering', () => {
  it('renders person with department badge and known_for titles', () => {
    const personResult: import('../services/catalog').SearchResult = {
      imdbId: 'nm0000123',
      title: 'Tom Hanks',
      type: 'person',
      known_for_department: 'Acting',
      known_for: [
        { imdbId: 'tt0120737', title: 'The Shawshank Redemption', type: 'movie' },
        { imdbId: 'tt0109830', title: 'Forrest Gump', type: 'movie' }
      ],
      posterUrl: 'https://image.tmdb.org/t/p/w92/path.jpg'
    };

    const html = renderToStaticMarkup(createElement(SearchResults, { results: [personResult], onSelect: vi.fn(), selectedIndex: -1 }));
    expect(html).toContain('Tom Hanks');
    expect(html).toContain('Acting');
    expect(html).toContain('The Shawshank Redemption');
  });
});
