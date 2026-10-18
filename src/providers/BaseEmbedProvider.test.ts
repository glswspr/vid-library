import { describe, it, expect } from 'vitest';
import { buildEmbedUrl } from './BaseEmbedProvider';

describe('buildEmbedUrl', () => {
  it('uses ? for a template without a query', () => {
    expect(buildEmbedUrl('https://x.test/movie/{id}', { id: 'tt1', type: 'movie', resumeAt: 120 }))
      .toBe('https://x.test/movie/tt1?resumeAt=120');
  });

  it('uses & for a template that already has a query', () => {
    expect(buildEmbedUrl('https://x.test/movie/{id}?autoPlay=true', { id: 'tt1', type: 'movie', resumeAt: 120 }))
      .toBe('https://x.test/movie/tt1?autoPlay=true&resumeAt=120');
  });

  it('returns the bare template when there is nothing to add', () => {
    expect(buildEmbedUrl('https://x.test/movie/{id}', { id: 'tt1', type: 'movie' }))
      .toBe('https://x.test/movie/tt1');
  });
});
