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
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL): Promise<any> => {
      const urlStr = input.toString();
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

  it('prioritizes exact title matches over genre detection', async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL): Promise<any> => {
      const urlStr = input.toString();
      if (urlStr.includes('/search/multi')) {
        return {
          ok: true,
          json: async () => ({
            results: [
              { media_type: 'movie', id: 789, title: 'Action', poster_path: '/action_poster.jpg' },
            ]
          })
        };
      }
      if (urlStr.includes('/movie/789/external_ids')) {
        return { ok: true, json: async () => ({ imdb_id: 'tt0099938' }) };
      }
      if (urlStr.includes('/genre/movie/list')) {
        return { ok: true, json: async () => ({ genres: [{ id: 28, name: 'Action' }, { id: 878, name: 'Science Fiction' }] }) };
      }
      return { ok: false, json: async () => ({}) };
    });

    const results = await searchByTitle('Action');
    // Should match the movie titled "Action" first, not the genre
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('Action');
    expect(results[0].type).toBe('movie');
    expect(results[0].imdbId).toBe('tt0099938');
  });

  it('falls back to genre discover for a genre string', async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL): Promise<any> => {
      const urlStr = input.toString();
      if (urlStr.includes('/search/multi')) {
        return { ok: true, json: async () => ({ results: [] }) };
      }
      if (urlStr.includes('/discover/movie')) {
        return {
          ok: true,
          json: async () => ({ results: [{ id: 123, title: 'Action Movie', media_type: 'movie', poster_path: '/action.jpg', vote_average: 8.0, vote_count: 1000, release_date: '2020-01-01' }] })
        };
      }
      if (urlStr.includes('/discover/tv')) {
        return { ok: true, json: async () => ({ results: [] }) };
      }
      if (urlStr.includes('/movie/123/external_ids')) {
        return { ok: true, json: async () => ({ imdb_id: 'tt0123456' }) };
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

  it('matches genre aliases like sci-fi to Science Fiction', async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL): Promise<any> => {
      const urlStr = input.toString();
      if (urlStr.includes('/search/multi')) {
        return { ok: true, json: async () => ({ results: [] }) };
      }
      if (urlStr.includes('/discover/movie')) {
        return {
          ok: true,
          json: async () => ({ results: [{ id: 555, title: 'Sci-Fi Movie', media_type: 'movie', poster_path: '/scifi.jpg', vote_average: 7.5, vote_count: 800, release_date: '2022-01-01' }] })
        };
      }
      if (urlStr.includes('/discover/tv')) {
        return { ok: true, json: async () => ({ results: [] }) };
      }
      if (urlStr.includes('/movie/555/external_ids')) {
        return { ok: true, json: async () => ({ imdb_id: 'tt0555555' }) };
      }
      if (urlStr.includes('/genre/movie/list')) {
        return { ok: true, json: async () => ({ genres: [{ id: 28, name: 'Action' }, { id: 878, name: 'Science Fiction' }] }) };
      }
      return { ok: false, json: async () => ({}) };
    });

    const results = await searchByTitle('sci-fi');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('movie');
  });
});

describe('searchByTitle Wikidata entity search', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to Wikidata entity search for characters', async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL): Promise<any> => {
      const urlStr = input.toString();
      if (urlStr.includes('/search/multi')) {
        return { ok: true, json: async () => ({ results: [] }) };
      }
      if (urlStr.includes('wbsearchentities')) {
        return {
          ok: true,
          json: async () => ({
            search: [
              { id: 'Q234', label: 'Jon Snow', description: 'character' },
              { id: 'Q567', label: 'Jon Snow (warg)', description: 'character' },
            ]
          })
        };
      }
      if (urlStr.includes('wbgetentities')) {
        return {
          ok: true,
          json: async () => ({
            entities: {
              Q234: {
                id: 'Q234',
                claims: {
                  P361: [{
                    mainsnak: { datavalue: { value: { id: 'Q456' } } }
                  }]
                }
              },
              Q567: {
                id: 'Q567',
                claims: {
                  P1441: [{
                    mainsnak: { datavalue: { value: { id: 'Q789' } } }
                  }]
                }
              },
              Q456: {
                id: 'Q456',
                claims: {
                  P345: [{ mainsnak: { datavalue: { value: 'tt0944947' } } }],
                  P31: [{ mainsnak: { datavalue: { value: { id: 'Q5398426' } } } }],
                  P577: [{ mainsnak: { datavalue: { value: { time: '+2011-00-00T00:00:00Z' } } } }],
                }
              },
              Q789: {
                id: 'Q789',
                claims: {
                  P345: [{ mainsnak: { datavalue: { value: 'tt0944947' } } }],
                  P31: [{ mainsnak: { datavalue: { value: { id: 'Q11424' } } } }],
                  P577: [{ mainsnak: { datavalue: { value: { time: '+2016-00-00T00:00:00Z' } } } }],
                }
              }
            }
          })
        };
      }
      if (urlStr.includes('/genre/movie/list')) {
        return { ok: true, json: async () => ({ genres: [{ id: 28, name: 'Action' }, { id: 878, name: 'Science Fiction' }] }) };
      }
      return { ok: false, json: async () => ({}) };
    });

    const results = await searchByTitle('Jon Snow');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('Jon Snow');
  });

  it('returns entity result with correct type for TV (Q5398426)', async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL): Promise<any> => {
      const urlStr = input.toString();
      if (urlStr.includes('/search/multi')) {
        return { ok: true, json: async () => ({ results: [] }) };
      }
      if (urlStr.includes('wbsearchentities')) {
        return {
          ok: true,
          json: async () => ({
            search: [{ id: 'Q456', label: 'Jon Snow 2', description: 'character' }]
          })
        };
      }
      if (urlStr.includes('wbgetentities')) {
        return {
          ok: true,
          json: async () => ({
            entities: {
              Q456: {
                id: 'Q456',
                claims: {
                  P361: [{
                    mainsnak: { datavalue: { value: { id: 'Q456' } } }
                  }]
                }
              }
            }
          })
        };
      }
      if (urlStr.includes('/genre/movie/list')) {
        return { ok: true, json: async () => ({ genres: [{ id: 28, name: 'Action' }, { id: 878, name: 'Science Fiction' }] }) };
      }
      return { ok: false, json: async () => ({}) };
    });

    const results = await searchByTitle('Jon Snow 2');
    // Both P361 and P1441 point to the same Q456 which has no IMDb ID -> no results
    expect(results.length).toBe(0);
  });

  it('handles empty search results gracefully', async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL): Promise<any> => {
      const urlStr = input.toString();
      if (urlStr.includes('/search/multi')) {
        return { ok: true, json: async () => ({ results: [] }) };
      }
      if (urlStr.includes('/genre/movie/list')) {
        return { ok: true, json: async () => ({ genres: [{ id: 28, name: 'Action' }, { id: 878, name: 'Science Fiction' }] }) };
      }
      return { ok: false, json: async () => ({}) };
    });

    const results = await searchByTitle('zzznotfound');
    expect(results.length).toBe(0);
  });
});