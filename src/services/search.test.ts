import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SearchResult } from './search';
import { searchByTitle } from './search';

vi.mock('../config', () => ({
  TMDB_API_KEY: '',
  OMDB_API_KEY: '',
  FALLBACK_TMDB_API_KEY: 'test-key',
  canUseTmdb: () => true,
  tmdbDirectUrl: (path: string) => `https://api.themoviedb.org/3${path}?api_key=test-key`,
  tmdbFetchJson: async () => null,
}));

describe('searchByTitle extended types', () => {
  it('SearchResult type includes person with known_for_department', () => {
    const personResult: SearchResult = {
      imdbId: 'nm0000123',
      title: 'Tom Hanks',
      type: 'person',
      known_for_department: 'Acting',
      known_for: [{ imdbId: 'tt0120737', title: 'The Shawshank Redemption', type: 'movie' }]
    };
    expect(personResult.type).toBe('person');
    expect(personResult.known_for_department).toBe('Acting');
  });

  it('searchByTitle returns person results for actor names', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (url: string) => {
      const urlStr = url.toString();
      if (urlStr.includes('/search/multi')) {
        return {
          ok: true,
          json: async () => ({
            results: [
              { media_type: 'person', id: 66633, name: 'Tom Hanks', known_for_department: 'Acting', known_for: [], profile_path: '/path.jpg' },
              { media_type: 'movie', id: 456, title: 'Test Movie', poster_path: '/movie.jpg' },
            ]
          })
        };
      }
      if (urlStr.includes('/external_ids')) {
        return {
          ok: true,
          json: async () => ({ imdb_id: 'tt0123456' })
        };
      }
      return { ok: false, json: async () => ({}) };
    });

    const results = await searchByTitle('Tom Hanks');
    const person = results.find(r => r.type === 'person');
    expect(person).toBeDefined();
    expect(person?.title).toBe('Tom Hanks');
    expect(person?.known_for_department).toBe('Acting');
  });
});
