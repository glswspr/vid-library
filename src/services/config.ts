/**
 * 2embed catalog API. In dev, routes through the Vite proxy to avoid CORS. */
export const EMBED2_BASE = import.meta.env.DEV ? '/embed2' : 'https://api.2embed.cc';

export const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';
export const OMDB_API_KEY = import.meta.env.VITE_OMDB_API_KEY || '';

/**
 * Fallback TMDB key that ships inside VidRock's public player bundle.
 * NOTE: any key used from the browser is public by construction — Vite inlines
 * `VITE_`-prefixed variables into the built JS. Prefer the server-side proxy
 * (see `api/tmdb.ts`), which keeps a real key out of the bundle entirely.
 */
export const FALLBACK_TMDB_API_KEY = import.meta.env.VITE_FALLBACK_TMDB_API_KEY || '';

export const TMDB_BASE = 'https://api.themoviedb.org/3';

/**
 * True when the server-side TMDB proxy is reachable for this deployment.
 * The proxy (api/tmdb.ts, Vercel) holds the key server-side; static hosts
 * such as Surge have no server, so they must use the direct client path.
 *
 * Opt out with VITE_TMDB_PROXY=false for a static-only build.
 */
export const TMDB_PROXY_ENABLED = import.meta.env.VITE_TMDB_PROXY !== 'false';

/**
 * Build a TMDB URL.
 *
 * When the proxy is enabled we point at `/api/tmdb/…` and let the server
 * attach the key, so no secret is ever sent from the browser. If the proxy
 * is not deployed it responds 503 and callers fall back to the direct URL.
 *
 * @param path  Resource path, e.g. `/movie/603`
 * @param key   Key to use for the direct (unproxied) path
 */
export function tmdbUrl(path: string, key?: string | null): string {
  if (TMDB_PROXY_ENABLED) {
    return `/api/tmdb${path}`;
  }
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
      const res = await fetch(`/api/tmdb${path}`, { signal });
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
    const directUrl = tmdbUrl(path, key);
    if (!directUrl) return null;
    const res = await fetch(directUrl, { signal });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    if (signal?.aborted || (e instanceof DOMException && e.name === 'AbortError')) throw e;
    return null;
  }
}
