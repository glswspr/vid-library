/**
 * Download resolution.
 *
 * The direct file links the embed players use are served by CDNs that answer
 * cross-origin reads with 403/428/429 and need a Referer a page cannot set. So
 * a small Cloudflare Worker (worker/download-worker.js) resolves and verifies
 * the candidates and streams the bytes back with Range support. This module is
 * only the client for that worker.
 */

import type { MediaType } from '../types';

/**
 * Base URL of the download worker. Override with `VITE_DOWNLOAD_WORKER` when
 * running against `wrangler dev` or a self-hosted copy.
 */
const WORKER_BASE = (
  import.meta.env.VITE_DOWNLOAD_WORKER ||
  'https://vidlib-download.behrooz-parham.workers.dev'
).replace(/\/$/, '');

export interface DownloadSource {
  provider: string;
  quality: string;
  format: 'mp4' | 'mkv' | string;
  size?: string;
  sizeBytes?: number;
  filename: string;
  /** Worker-hosted URL (signed, short-lived, Range-capable). */
  url: string;
  /** Upstream CDN URL, for "copy link" fallbacks. */
  directUrl?: string;
}

export interface DownloadRequest {
  tmdbId: string;
  type: MediaType;
  season?: number;
  episode?: number;
  title?: string;
  signal?: AbortSignal;
}

const cache = new Map<string, DownloadSource[]>();
const CACHE_TTL_MS = 10 * 60 * 1000;
const cacheTimes = new Map<string, number>();

export function downloadCacheKey({ tmdbId, type, season, episode }: DownloadRequest): string {
  return type === 'tv'
    ? `tv:${tmdbId}:${season ?? 1}:${episode ?? 1}`
    : `movie:${tmdbId}`;
}

/** Resolve downloadable files for one title (movie or a single episode). */
export async function fetchDownloads({
  tmdbId,
  type,
  season,
  episode,
  title,
  signal,
}: DownloadRequest): Promise<DownloadSource[]> {
  const key = downloadCacheKey({ tmdbId, type, season, episode });
  const cachedAt = cacheTimes.get(key);
  if (cachedAt && Date.now() - cachedAt < CACHE_TTL_MS && cache.has(key)) {
    return cache.get(key) || [];
  }

  const params = new URLSearchParams({ type, tmdb: tmdbId });
  if (season != null && episode != null) {
    params.set('season', String(season));
    params.set('episode', String(episode));
  }
  if (title) params.set('title', title);

  try {
    const res = await fetch(`${WORKER_BASE}/resolve?${params.toString()}`, { signal });
    if (!res.ok) return [];
    const data = (await res.json()) as { sources?: DownloadSource[] };
    const sources = Array.isArray(data.sources) ? data.sources : [];
    cache.set(key, sources);
    cacheTimes.set(key, Date.now());
    return sources;
  } catch (e) {
    if (signal?.aborted || (e instanceof DOMException && e.name === 'AbortError')) throw e;
    return [];
  }
}
