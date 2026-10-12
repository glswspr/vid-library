import type { MediaItem, MediaType } from '../types';
import { TMDB_API_KEY, FALLBACK_TMDB_API_KEY, canUseTmdb, tmdbFetchJson } from './config';
import { mapTmdbResult } from './embed2';
import { resolveTmdbFromImdb } from './metadata';
import { getAllWatchProgress } from '../utils/storage';

// Declarative home-page rows. Each row is defined by a stable, settings-aware
// id (used as the cache key), a title, and a fetch closure. The renderer
// (HomeRows/HomeRow) handles lazy loading, skeletons, and cross-row dedupe.

export interface HomeRowDef {
  id: string;
  title: string;
  icon: 'movie' | 'tv' | 'sparkles';
  /** Recommendation rows track watch history, so they skip persistent caching. */
  cached: boolean;
  fetch: () => Promise<MediaItem[]>;
}

export interface Genre {
  id: number;
  name: string;
}

const ROW_LIMIT = 20;

function getTmdbKey(): string | null {
  const key = TMDB_API_KEY || FALLBACK_TMDB_API_KEY;
  return key || null;
}

async function fetchTmdbList(
  path: string,
  params: Record<string, string>,
  type: MediaType,
): Promise<MediaItem[]> {
  const key = getTmdbKey();
  if (!canUseTmdb(key)) return [];
  try {
    const qs = new URLSearchParams(params);
    if (key) qs.set('api_key', key);
    const data = await tmdbFetchJson(`/${path}?${qs.toString()}`, key) as { results?: unknown[] } | null;
    if (!data?.results) return [];
    return data.results.slice(0, ROW_LIMIT).map((it) => mapTmdbResult(it, type));
  } catch (e) {
    console.warn(`TMDB row fetch failed: ${path}`, e);
    return [];
  }
}

// --- Row cache ---------------------------------------------------------------
// In-memory first, mirrored to localStorage with a 1-hour TTL so returning to
// the home page (or reloading within the hour) doesn't re-fetch every row.
// Empty results are never cached so a flaky network recovers on next visit.

const ROW_TTL = 60 * 60 * 1000;
const ROW_CACHE_KEY = 'vid_library_row_cache_v1';
const ROW_CACHE_MAX = 24;

const rowMemCache = new Map<string, { at: number; items: MediaItem[] }>();

function readPersistedCache(): Record<string, { at: number; items: MediaItem[] }> {
  try {
    const raw = localStorage.getItem(ROW_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistCache(id: string, entry: { at: number; items: MediaItem[] }): void {
  try {
    const all = readPersistedCache();
    all[id] = entry;
    const ids = Object.keys(all);
    if (ids.length > ROW_CACHE_MAX) {
      ids
        .sort((a, b) => (all[a].at || 0) - (all[b].at || 0))
        .slice(0, ids.length - ROW_CACHE_MAX)
        .forEach((old) => delete all[old]);
    }
    localStorage.setItem(ROW_CACHE_KEY, JSON.stringify(all));
  } catch {
    // quota errors are non-fatal
  }
}

export async function loadRow(def: HomeRowDef): Promise<MediaItem[]> {
  if (def.cached) {
    const mem = rowMemCache.get(def.id);
    if (mem && Date.now() - mem.at < ROW_TTL) return mem.items;
    const stored = readPersistedCache()[def.id];
    if (stored && Date.now() - stored.at < ROW_TTL) {
      rowMemCache.set(def.id, stored);
      return stored.items;
    }
  }

  let items: MediaItem[] = [];
  try {
    items = await def.fetch();
  } catch {
    items = [];
  }

  if (def.cached && items.length > 0) {
    const entry = { at: Date.now(), items };
    rowMemCache.set(def.id, entry);
    persistCache(def.id, entry);
  }
  return items;
}

// --- Genre catalog -----------------------------------------------------------

const GENRES_KEY = 'vid_library_genres_v1';
const GENRES_TTL = 7 * 24 * 60 * 60 * 1000;

export async function getMovieGenres(): Promise<Genre[]> {
  try {
    const raw = localStorage.getItem(GENRES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { at: number; items: Genre[] };
      if (parsed?.items?.length && Date.now() - parsed.at < GENRES_TTL) {
        return parsed.items;
      }
    }
  } catch {
    // fall through to fetch
  }

  const key = getTmdbKey();
  if (!canUseTmdb(key)) return [];
  try {
    const data = await tmdbFetchJson('/genre/movie/list', key) as { genres?: { id: number; name: string }[] } | null;
    if (!data?.genres) return [];
    const items = data.genres.filter((g) => g?.id && g?.name);
    try {
      localStorage.setItem(GENRES_KEY, JSON.stringify({ at: Date.now(), items }));
    } catch {
      // quota errors are non-fatal
    }
    return items;
  } catch (e) {
    console.warn('TMDB genre list fetch failed:', e);
    return [];
  }
}

// --- Row definitions -----------------------------------------------------------

function langFilter(englishOnly: boolean): Record<string, string> {
  return englishOnly ? { with_original_language: 'en' } : {};
}

/** Up to two personalized rows from the most recently watched titles. */
function buildRecommendationRows(): HomeRowDef[] {
  const seen = new Set<string>();
  const seeds: { id: string; title: string; type: MediaType }[] = [];
  for (const entry of getAllWatchProgress()) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    seeds.push({ id: entry.id, title: entry.title, type: entry.type });
    if (seeds.length >= 2) break;
  }

  return seeds.map((seed) => ({
    id: `rec:${seed.type}:${seed.id}`,
    title: `Because you watched ${seed.title}`,
    icon: 'sparkles' as const,
    cached: false,
    fetch: async () => {
      const tmdbId = seed.id.startsWith('tt')
        ? (await resolveTmdbFromImdb(seed.id, seed.type))?.id
        : seed.id;
      if (!tmdbId) return [];
      return fetchTmdbList(`${seed.type}/${tmdbId}/recommendations`, {}, seed.type);
    },
  }));
}

export interface RowBuildSettings {
  englishOnly: boolean;
  genreRows: number[];
}

export function buildHomeRows(
  settings: RowBuildSettings,
  genreNames: Map<number, string> | null,
): HomeRowDef[] {
  const lang = langFilter(settings.englishOnly);
  const rows: HomeRowDef[] = [];

  rows.push({
    id: `top-rated:${settings.englishOnly}`,
    title: 'Top Rated Movies',
    icon: 'movie',
    cached: true,
    fetch: () => fetchTmdbList('movie/top_rated', { ...lang }, 'movie'),
  });

  rows.push(...buildRecommendationRows());

  if (genreNames) {
    for (const genreId of settings.genreRows) {
      const name = genreNames.get(genreId);
      if (!name) continue;
      rows.push({
        id: `genre:${genreId}:${settings.englishOnly}`,
        title: `${name} Movies`,
        icon: 'movie',
        cached: true,
        fetch: () =>
          fetchTmdbList(
            'discover/movie',
            {
              sort_by: 'popularity.desc',
              with_genres: String(genreId),
              'vote_average.gte': '6.8',
              'vote_count.gte': '1000',
              ...lang,
            },
            'movie',
          ),
      });
    }
  }

  return rows;
}
