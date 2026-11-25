import { describe, it, expect } from 'vitest';
import { buildEmbedUrl } from './BaseEmbedProvider';
import { vidLinkProvider } from './VidLinkProvider';
import { vidPrimeProvider } from './VidPrimeProvider';
import { vidNestProvider } from './VidNestProvider';
import { vidCoreProvider } from './VidCoreProvider';
import { vidSrcProvider } from './VidSrcProvider';
import { mappleProvider } from './MappleProvider';
import { vidZeeProvider } from './VidZeeProvider';
import { vidApiProvider } from './VidApiProvider';
import { m111Provider } from './M111Provider';

describe('buildEmbedUrl', () => {
  it('uses ? for a template without a query', () => {
    expect(buildEmbedUrl('https://x.test/movie/{id}', { id: 'tt1', type: 'movie', resumeAt: 120 }))
      .toBe('https://x.test/movie/tt1?startAt=120');
  });

  it('uses & for a template that already has a query', () => {
    expect(buildEmbedUrl('https://x.test/movie/{id}?lang=en', { id: 'tt1', type: 'movie', resumeAt: 120 }))
      .toBe('https://x.test/movie/tt1?lang=en&startAt=120');
  });

  it('returns the bare template when there is nothing to add', () => {
    expect(buildEmbedUrl('https://x.test/movie/{id}', { id: 'tt1', type: 'movie' }))
      .toBe('https://x.test/movie/tt1');
  });

  it('leaves the position out when the provider has no start-at parameter', () => {
    expect(buildEmbedUrl('https://x.test/movie/{id}', { id: 'tt1', type: 'movie', resumeAt: 120 }, null))
      .toBe('https://x.test/movie/tt1');
  });
});

describe('provider resume parameters', () => {
  it('VidPrime starts at the stored position', () => {
    const url = vidPrimeProvider.getEmbedUrl({ id: '550', type: 'movie', resumeAt: 120 });
    expect(url).toBe('https://vidprime.top/movie/550?startAt=120');
  });

  it('VidNest starts at the stored position with `t`', () => {
    const url = vidNestProvider.getEmbedUrl({ id: '550', type: 'tv', season: 1, episode: 1, resumeAt: 120 });
    expect(url).toBe('https://vidnest.pro/tv/550/1/1?t=120');
  });

  it('VidLink ignores the stored position, so none is sent', () => {
    const url = vidLinkProvider.getEmbedUrl({ id: '550', type: 'tv', season: 2, episode: 3, resumeAt: 120 });
    expect(url).toBe('https://vidlink.pro/tv/550/2/3');
  });
});

describe('provider embed paths', () => {
  const cases: Array<[string, { getEmbedUrl: (o: { id: string; type: 'movie' | 'tv'; season?: number; episode?: number }) => string | Promise<string> }, string, string]> = [
    ['VidCore', vidCoreProvider, 'https://vidcore.io/movie/550', 'https://vidcore.io/tv/550/2/3'],
    ['VidSrc', vidSrcProvider, 'https://vidsrc.to/embed/movie/550', 'https://vidsrc.to/embed/tv/550/2/3'],
    ['Mapple', mappleProvider, 'https://mappletv.uk/watch/movie/550', 'https://mappletv.uk/watch/tv/550/2/3'],
    ['VidZee', vidZeeProvider, 'https://player.vidzee.wtf/embed/movie/550', 'https://player.vidzee.wtf/embed/tv/550/2/3'],
    ['VidAPI', vidApiProvider, 'https://vaplayer.ru/embed/movie/550', 'https://vaplayer.ru/embed/tv/550/2/3'],
    ['111Movies', m111Provider, 'https://111movies.net/movie/550', 'https://111movies.net/tv/550/2/3'],
  ];

  for (const [name, provider, movie, tv] of cases) {
    it(`${name} uses its documented movie and TV paths`, () => {
      expect(provider.getEmbedUrl({ id: '550', type: 'movie' })).toBe(movie);
      expect(provider.getEmbedUrl({ id: '550', type: 'tv', season: 2, episode: 3 })).toBe(tv);
    });
  }
});
