import { describe, it, expect } from 'vitest';
import type { SearchResult } from './search';

describe('searchByTitle extended types', () => {
  it('SearchResult type includes person with known_for_department', () => {
    // Type test: SearchResult should accept 'person' type
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
});
