import type { ProviderId } from '../types';

/**
 * The one list of live provider ids, in the default fallback order. Settings,
 * storage and the player all read it from here, so a dead server is dropped in
 * one place. Kept apart from `index.ts` so storage does not pull the provider
 * implementations in with it.
 *
 * Order is by how reliably each one started when checked in the app on
 * 2026-11-25: VidPrime, VixSrc and VidNest started first time for both a movie
 * and a TV episode; VidSrc, Mapple, VidZee and VidCore played too but are more
 * ad-heavy or fail on some titles; VidAPI needs a warm session and 111Movies
 * sometimes shows a Cloudflare check, so those sit last.
 */
export const PROVIDER_IDS: ProviderId[] = [
  'vidprime',
  'vixsrc',
  'vidnest',
  'vidlink',
  'vidsrc',
  'mapple',
  'vidzee',
  'vidcore',
  'peachify',
  'vidapi',
  'm111',
];

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && (PROVIDER_IDS as string[]).includes(value);
}
