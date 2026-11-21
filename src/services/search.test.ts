import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

vi.mock('./rows', () => ({
  getMovieGenres: async () => [{ id: 28, name: 'Action' }, { id: 878, name: 'Science Fiction' }]
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
      if (urlStr.includes('/genre/movie/list')) {
        return { ok: true, json: async () => ({ genres: [{ id: 28, name: 'Action' }, { id: 878, name: 'Science Fiction' }] }) };
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

describe('searchByTitle genre detection', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('detects genre query and uses discover endpoint', async () => {
    // Mock fetch for discover endpoint
    vi.spyOn(global, 'fetch').mockImplementation(async (url: string) => {
      const urlStr = url.toString();
      if (urlStr.includes('/discover/movie')) {
        return {
          ok: true,
          json: async () => ({ results: [{ id: 123, title: 'Action Movie', media_type: 'movie', poster_path: '/action.jpg', vote_average: 8.0, vote_count: 1000, release_date: '2020-01-01' }] })
        };
      }
      if (urlStr.includes('/search/multi')) {
        return { ok: true, json: async () => ({ results: [] }) };
      }
      if (urlStr.includes('/genre/movie/list')) {
        return { ok: true, json: async () => ({ genres: [{ id: 28, name: 'Action' }, { id: 878, name: 'Science Fiction' }] }) };
      }
      return { ok: false, json: async () => ({}) };
    });

    const results = await searchByTitle('action');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('movie');
  });
});

describe('searchByTitle Wikidata entity search', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to Wikidata entity search for characters', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (url: string) => {
      const urlStr = url.toString();
      if (urlStr.includes('/search/multi')) {
        return { ok: true, json: async () => ({ results: [] }) };
      }
      if (urlStr.includes('wbsearchentities')) {
        return {
          ok: true,
          json: async () => ({
            search: [{ id: 'Q123', label: 'Jon Snow', description: 'Game of Thrones character' }]
          })
        };
      }
      if (urlStr.includes('wbgetentities')) {
        return {
          ok: true,
          json: async () => ({
            entities: {
              Q123: {
                claims: {
                  P31: [{ mainsnak: { datavalue: { value: { id: 'Q5' } } } }],
                  P361: [{ mainsnak: { datavalue: { value: { id: 'Q12345' } } } }]
                }
              },
              Q12345: {
                claims: {
                  P345: [{ mainsnak: { datavalue: { value: 'tt0944947' } } }],
                  P31: [{ mainsnak: { datavalue: { value: { id: 'Q5398426' } } } }],
                  P577: [{ mainsnak: { datavalue: { value: { time: '+2011-04-17T00:00:00Z' } } } }]
                }
              }
            }
          })
        };
      }
      if (urlStr.includes('omdbapi.com')) {
        return { ok: true, json: async () => ({ Response: 'False' }) };
      }
      if (urlStr.includes('/genre/movie/list')) {
        return { ok: true, json: async () => ({ genres: [{ id: 28, name: 'Action' }, { id: 878, name: 'Science Fiction' }] }) };
      }
      return { ok: false, json: async () => ({}) };
    });

    const results = await searchByTitle('Jon Snow');
    const character = results.find(r => r.title === 'Jon Snow');
    expect(character).toBeDefined();
  });
});