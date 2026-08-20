import type { ProviderId, WatchlistItem, WatchProgress } from '../types';
import { PROVIDER_MEMORY_MAX_ENTRIES } from '../constants';

// Every storage operation is guarded against quota errors and serialization
// failures so the app degrades gracefully instead of crashing.

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to write to localStorage key "${key}":`, e);
  }
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

const KEYS = {
  PROVIDER: 'vid_library_provider',
  PROGRESS: 'vid_library_progress_v2',
  WATCHLIST: 'vid_library_watchlist_v1',
  PROVIDER_MEMORY: 'vid_library_provider_memory_v1',
};

// Embeds fall back in this order: vidrock/vidapi are CORS-open, videasy is a
// reliable third option, peachify is second-tier, vidsrc is last (most ad-heavy),
// with vidcore/vidzee as additional options.
const VALID_PROVIDERS: ProviderId[] = ['vidrock', 'vidapi', 'videasy', 'peachify', 'vidsrc', 'vidcore', 'vidzee'];

function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && (VALID_PROVIDERS as string[]).includes(value);
}

export function getPreferredProvider(): ProviderId {
  const saved = readRaw(KEYS.PROVIDER);
  if (isProviderId(saved)) return saved;
  return 'vidrock';
}

export function setPreferredProvider(provider: ProviderId): void {
  writeJson(KEYS.PROVIDER, provider);
}

// Remembers which embed server last worked for a given title so we can
// auto-start on the reliable server and skip dead ones on fallback.
// (A client can't probe embed domains directly due to CORS, so we use the
// iframe's onLoad as a lightweight reachability signal instead.)

function readProviderMemory(): Record<string, ProviderId> {
  const parsed = readJson<Record<string, unknown>>(KEYS.PROVIDER_MEMORY, {});
  const out: Record<string, ProviderId> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (isProviderId(value)) out[key] = value;
  }
  return out;
}

/** Best-guess server order: remembered-good first, then the rest. */
export function getProviderFallbackOrder(): ProviderId[] {
  const memory = readProviderMemory();
  const ordered: ProviderId[] = [];
  const seen = new Set<ProviderId>();
  for (const value of Object.values(memory)) {
    if (seen.has(value)) continue;
    ordered.push(value);
    seen.add(value);
  }
  for (const id of VALID_PROVIDERS) {
    if (!seen.has(id)) ordered.push(id);
  }
  return ordered;
}

export function getRememberedProvider(mediaId: string): ProviderId | null {
  const memory = readProviderMemory();
  return memory[mediaId] || null;
}

export function rememberProvider(mediaId: string, provider: ProviderId): void {
  const memory = readProviderMemory();
  memory[mediaId] = provider;
  const entries = Object.entries(memory);
  // Cap the map so it can't grow unboundedly.
  const trimmed = entries.length > PROVIDER_MEMORY_MAX_ENTRIES
    ? Object.fromEntries(entries.slice(entries.length - PROVIDER_MEMORY_MAX_ENTRIES))
    : memory;
  writeJson(KEYS.PROVIDER_MEMORY, trimmed);
}

export function getWatchlist(): WatchlistItem[] {
  const items = readJson<Record<string, WatchlistItem>>(KEYS.WATCHLIST, {});
  return Object.values(items).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function isInWatchlist(id: string): boolean {
  const items = readJson<Record<string, WatchlistItem>>(KEYS.WATCHLIST, {});
  return Boolean(items[id]);
}

/** Add/remove a title. Returns true if it is now in the watchlist. */
export function toggleWatchlist(
  item: Omit<WatchlistItem, 'updatedAt'>,
): boolean {
  const items = readJson<Record<string, WatchlistItem>>(KEYS.WATCHLIST, {});
  if (items[item.id]) {
    delete items[item.id];
    writeJson(KEYS.WATCHLIST, items);
    return false;
  }
  items[item.id] = { ...item, updatedAt: Date.now() };
  writeJson(KEYS.WATCHLIST, items);
  return true;
}

export function getAllWatchProgress(): WatchProgress[] {
  const items = readJson<Record<string, WatchProgress>>(KEYS.PROGRESS, {});
  return Object.values(items).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getWatchProgress(id: string, season?: number, episode?: number): WatchProgress | null {
  const items = readJson<Record<string, WatchProgress>>(KEYS.PROGRESS, {});
  const key = season && episode ? `${id}_s${season}e${episode}` : id;
  return items[key] || null;
}

export function saveWatchProgress(progress: WatchProgress): void {
  const items = readJson<Record<string, WatchProgress>>(KEYS.PROGRESS, {});
  const key = progress.seasonNumber && progress.episodeNumber 
    ? `${progress.id}_s${progress.seasonNumber}e${progress.episodeNumber}`
    : progress.id;

  items[key] = {
    ...progress,
    updatedAt: Date.now()
  };

  writeJson(KEYS.PROGRESS, items);
}

/** Persist a resolved rating onto a stored watchlist item (no-op if it already has one). */
export function updateWatchlistRating(id: string, rating: string): void {
  const items = readJson<Record<string, WatchlistItem>>(KEYS.WATCHLIST, {});
  const item = items[id];
  if (!item || item.rating) return;
  item.rating = rating;
  writeJson(KEYS.WATCHLIST, items);
}

/** Persist a resolved rating onto a stored progress item (no-op if it already has one). */
export function updateProgressRating(
  id: string,
  rating: string,
  season?: number,
  episode?: number,
): void {
  const items = readJson<Record<string, WatchProgress>>(KEYS.PROGRESS, {});
  const key = season && episode ? `${id}_s${season}e${episode}` : id;
  const item = items[key];
  if (!item || item.rating) return;
  item.rating = rating;
  writeJson(KEYS.PROGRESS, items);
}

/** Persist a resolved poster onto a stored watchlist item (no-op if it already has one). */
export function updateWatchlistPoster(id: string, posterUrl: string): void {
  const items = readJson<Record<string, WatchlistItem>>(KEYS.WATCHLIST, {});
  const item = items[id];
  if (!item || item.posterUrl) return;
  item.posterUrl = posterUrl;
  writeJson(KEYS.WATCHLIST, items);
}

/** Persist a resolved poster onto a stored progress item (no-op if it already has one). */
export function updateProgressPoster(
  id: string,
  posterUrl: string,
  season?: number,
  episode?: number,
): void {
  const items = readJson<Record<string, WatchProgress>>(KEYS.PROGRESS, {});
  const key = season && episode ? `${id}_s${season}e${episode}` : id;
  const item = items[key];
  if (!item || item.posterUrl) return;
  item.posterUrl = posterUrl;
  writeJson(KEYS.PROGRESS, items);
}
