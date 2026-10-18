import { describe, it, expect } from 'vitest';
import { buildEmbedUrl } from './BaseEmbedProvider';
import { vidCoreProvider } from './VidCoreProvider';

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

describe('vidCoreProvider', () => {
  it('keeps its autoplay parameter when a resume position is added', () => {
    const url = vidCoreProvider.getEmbedUrl({ id: 'tt1', type: 'movie', resumeAt: 120 });
    expect(url).toBe('https://vidcore.io/movie/tt1?autoPlay=true&resumeAt=120');
  });

  it('builds a tv url with autoplay', () => {
    const url = vidCoreProvider.getEmbedUrl({ id: 'tt1', type: 'tv', season: 2, episode: 3 });
    expect(url).toBe('https://vidcore.io/tv/tt1/2/3?autoPlay=true');
  });
});
