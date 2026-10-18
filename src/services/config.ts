/**
 * 2embed catalog API. In dev, routes through the Vite proxy to avoid CORS. */
export const EMBED2_BASE = import.meta.env.DEV ? '/embed2' : 'https://api.2embed.cc';

export const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';
export const OMDB_API_KEY = import.meta.env.VITE_OMDB_API_KEY || '';

/**
 * Fallback TMDB key that ships inside VidRock's public player bundle.
 * NOTE: any key used from the browser is public by construction — Vite inlines
 * `VITE_`-prefixed variables into the built JS. Prefer the server-side proxy
 * (see `api/tmdb/[...path].ts`), which keeps a real key out of the bundle entirely.
 */
export const FALLBACK_TMDB_API_KEY = import.meta.env.VITE_FALLBACK_TMDB_API_KEY || '54e00466a09676df57ba51c4ca30b1a6';

export const TMDB_BASE = 'https://api.themoviedb.org/3';

/**
 * True when the server-side TMDB proxy is reachable for this deployment.
 * The proxy (api/tmdb/[...path].ts, Vercel) holds the key server-side; static hosts
 * such as Surge have no server, so they must use the direct client path.
 *
 * Opt out with VITE_TMDB_PROXY=false for a static-only build.
 */
export const TMDB_PROXY_ENABLED = import.meta.env.VITE_TMDB_PROXY !== 'false';

/**
 * Build a TMDB URL for the server-side proxy.
 *
 * @param path  Resource path, e.g. `/movie/603`
 */
export function tmdbProxyUrl(path: string): string {
  return `/api/tmdb${path}`;
}

/**
 * Build a direct TMDB URL with an API key.
 *
 * @param path  Resource path, e.g. `/movie/603`
 * @param key   API key to append
 */
export function tmdbDirectUrl(path: string, key: string): string {
  if (!key) return '';
  const separator = path.includes('?') ? '&' : '?';
  return `${TMDB_BASE}${path}${separator}api_key=${encodeURIComponent(key)}`;
}

/** Whether a TMDB call can be made at all (proxy available, or a key supplied). */
export function canUseTmdb(key?: string | null): boolean {
  return TMDB_PROXY_ENABLED || Boolean(key);
}

/**
 * Fetch a TMDB resource as JSON, transparently choosing between the
 * server-side proxy and a direct client call.
 *
 * The proxy claim is "authoritative" only when it actually answers with JSON:
 * - JSON + 2xx → parsed body
 * - anything else (non-JSON HTML from a static host with no `api/` function,
 *   503 "not configured", network error) → fall through to the direct path,
 *   which needs a key and returns null when there is none.
 *
 * Returns null when the request cannot be made or fails.
 */
export async function tmdbFetchJson(
  path: string,
  key?: string | null,
  signal?: AbortSignal,
): Promise<unknown | null> {
  if (TMDB_PROXY_ENABLED) {
    try {
      const res = await fetch(tmdbProxyUrl(path), { signal });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('json') && res.ok) {
        return await res.json();
      }
      // Not a JSON 2xx → the proxy isn't usable here; try the direct path.
    } catch (e) {
      if (signal?.aborted || (e instanceof DOMException && e.name === 'AbortError')) throw e;
      // Network failure — try the direct path.
    }
  }

  if (!key) return null;
  try {
    const directUrl = tmdbDirectUrl(path, key);
    if (!directUrl) return null;
    const res = await fetch(directUrl, { signal });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    if (signal?.aborted || (e instanceof DOMException && e.name === 'AbortError')) throw e;
    return null;
  }
}
