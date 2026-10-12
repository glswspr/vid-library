import type { ProviderId, WatchlistItem, WatchProgress } from '../types';
import { PROGRESS_FLUSH_DELAY_MS, PROVIDER_MEMORY_MAX_ENTRIES } from '../constants';

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
  HEALTH: 'vid_library_server_health',
};

// Embeds fall back in this order: vidrock/vidapi are CORS-open, videasy is a
// reliable third option, peachify is second-tier, vidsrc is last (most ad-heavy),
// with vidcore/vidzee/mapple/111movies/streamx as additional options.
const VALID_PROVIDERS: ProviderId[] = ['vidrock', 'vidapi', 'videasy', 'peachify', 'vidsrc', 'vidcore', 'vidzee', 'mapple', 'm111', 'streamx'];

export interface ServerHealth {
  success: number;
  failure: number;
  lastResult: 'success' | 'failure';
  lastUpdated: number;
}

function readServerHealth(): Record<string, ServerHealth> {
  return readJson<Record<string, ServerHealth>>(KEYS.HEALTH, {});
}

export function recordServerSuccess(provider: string): void {
  const map = readServerHealth();
  const prev = map[provider];
  map[provider] = {
    success: (prev?.success ?? 0) + 1,
    failure: prev?.failure ?? 0,
    lastResult: 'success',
    lastUpdated: Date.now(),
  };
  writeJson(KEYS.HEALTH, map);
  window.dispatchEvent(new Event('server-health-changed'));
}

export function recordServerFailure(provider: string): void {
  const map = readServerHealth();
  const prev = map[provider];
  map[provider] = {
    success: prev?.success ?? 0,
    failure: (prev?.failure ?? 0) + 1,
    lastResult: 'failure',
    lastUpdated: Date.now(),
  };
  writeJson(KEYS.HEALTH, map);
  window.dispatchEvent(new Event('server-health-changed'));
}

export function getServerHealth(provider: string): ServerHealth | null {
  return readServerHealth()[provider] ?? null;
}

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
  let added: boolean;
  if (items[item.id]) {
    delete items[item.id];
    added = false;
  } else {
    items[item.id] = { ...item, updatedAt: Date.now() };
    added = true;
  }
  writeJson(KEYS.WATCHLIST, items);
  window.dispatchEvent(new Event('watchlist-changed'));
  return added;
}

// --- Batched progress writes -------------------------------------------------
// Rapid PLAYER_EVENT messages during playback would otherwise re-serialize the
// whole progress map to localStorage several times per second. Instead, all
// progress mutations update an in-memory cache immediately (so reads stay
// consistent) and the actual write is coalesced: requestIdleCallback flushes
// when the main thread is free, with a hard 2-second cap via its timeout
// option (setTimeout fallback where requestIdleCallback is unavailable).
// A synchronous flush on page hide/close prevents losing buffered progress.

let progressCache: Record<string, WatchProgress> | null = null;
let progressFlushPending = false;
// Only pages that actually MUTATE progress may write it back. Without this
// flag, a read-only page (any home page that just renders Continue Watching)
// re-persisted its empty cache on pagehide, silently destroying entries
// written by another tab or before a reload.
let progressDirty = false;

function ensureProgressCache(): Record<string, WatchProgress> {
  if (progressCache === null) {
    progressCache = readJson<Record<string, WatchProgress>>(KEYS.PROGRESS, {});
  }
  return progressCache;
}

function writeProgressCacheNow(): void {
  progressFlushPending = false;
  if (progressCache !== null && progressDirty) {
    writeJson(KEYS.PROGRESS, progressCache);
    progressDirty = false;
  }
}

function scheduleProgressFlush(): void {
  if (progressFlushPending) return;
  progressFlushPending = true;
  const flush = () => {
    // A synchronous flush (page hide) or page lifecycle may have already run.
    if (!progressFlushPending) return;
    writeProgressCacheNow();
  };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(flush, { timeout: PROGRESS_FLUSH_DELAY_MS });
  } else {
    setTimeout(flush, PROGRESS_FLUSH_DELAY_MS);
  }
}

function mutateProgress(fn: (items: Record<string, WatchProgress>) => void): void {
  const items = ensureProgressCache();
  fn(items);
  progressDirty = true;
  scheduleProgressFlush();
  notifyProgressChanged();
}

/**
 * Single source of truth for "watch history changed" notifications.
 * Consumers (Continue Watching, Watch History, Watch Stats) listen for this
 * event, so every write path through `mutateProgress` must emit it — including
 * `clearWatchHistory`, which previously bypassed the in-memory cache entirely.
 */
function notifyProgressChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('watch-progress-updated'));
}

if (typeof window !== 'undefined') {
  const flushBufferedProgress = () => writeProgressCacheNow();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushBufferedProgress();
  });
  window.addEventListener('pagehide', flushBufferedProgress);
}

export function getAllWatchProgress(): WatchProgress[] {
  const items = ensureProgressCache();
  return Object.values(items).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getWatchProgress(id: string, season?: number, episode?: number): WatchProgress | null {
  const items = ensureProgressCache();
  const key = season && episode ? `${id}_s${season}e${episode}` : id;
  return items[key] || null;
}

export function saveWatchProgress(progress: WatchProgress): void {
  const key = progress.seasonNumber && progress.episodeNumber
    ? `${progress.id}_s${progress.seasonNumber}e${progress.episodeNumber}`
    : progress.id;

  mutateProgress((items) => {
    const existing = items[key];
    // Merge with the stored entry so backfilled metadata (genre, rating,
    // poster) survives partial updates from player events.
    items[key] = {
      ...existing,
      ...progress,
      posterUrl: progress.posterUrl || existing?.posterUrl,
      rating: progress.rating || existing?.rating,
      genre: progress.genre || existing?.genre,
      updatedAt: Date.now()
    };
  });
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
  const key = season && episode ? `${id}_s${season}e${episode}` : id;
  mutateProgress((items) => {
    const item = items[key];
    if (!item || item.rating) return;
    item.rating = rating;
  });
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
  const key = season && episode ? `${id}_s${season}e${episode}` : id;
  mutateProgress((items) => {
    const item = items[key];
    if (!item || item.posterUrl) return;
    item.posterUrl = posterUrl;
  });
}

/** Persist a resolved genre onto every stored progress entry of a title. */
export function updateProgressGenreForShow(id: string, genre: string): void {
  if (!genre) return;
  mutateProgress((items) => {
    for (const item of Object.values(items)) {
      if (item.id === id && !item.genre) item.genre = genre;
    }
  });
}

/** Remove a single watch progress entry by key. */
export function removeWatchProgress(id: string, season?: number, episode?: number): void {
  const key = season && episode ? `${id}_s${season}e${episode}` : id;
  mutateProgress((items) => {
    delete items[key];
  });
}

/**
 * Remove every watch progress entry for a title.
 * Continue Watching renders one card per show (the most recent episode), so
 * dismissing that card has to clear all of the show's episode entries —
 * otherwise the next remaining episode is picked back up on reload and the
 * show reappears in the list.
 */
export function removeShowWatchProgress(id: string): void {
  mutateProgress((items) => {
    for (const [key, item] of Object.entries(items)) {
      if (item.id === id) delete items[key];
    }
  });
}

export function clearWatchHistory(): void {
  progressCache = {};
  progressDirty = true;
  writeProgressCacheNow();
  writeJson(KEYS.PROVIDER_MEMORY, {});
  notifyProgressChanged();
}

/** Mark an episode as fully watched (completed=true, progress=duration). */
export function markEpisodeWatched(progress: Omit<WatchProgress, 'completed' | 'updatedAt'>): void {
  const key = progress.seasonNumber && progress.episodeNumber
    ? `${progress.id}_s${progress.seasonNumber}e${progress.episodeNumber}`
    : progress.id;
  mutateProgress((items) => {
    const existing = items[key];
    items[key] = {
      ...existing,
      ...progress,
      posterUrl: progress.posterUrl || existing?.posterUrl,
      rating: progress.rating || existing?.rating,
      genre: progress.genre || existing?.genre,
      completed: true,
      progress: progress.duration,
      updatedAt: Date.now(),
    };
  });
}

/** Mark an episode as unwatched (remove progress entry). */
export function markEpisodeUnwatched(id: string, season?: number, episode?: number): void {
  const key = season && episode ? `${id}_s${season}e${episode}` : id;
  mutateProgress((items) => {
    delete items[key];
  });
}
