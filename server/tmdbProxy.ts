/**
 * Shared TMDB proxy logic.
 *
 * Implemented once and used by both the dev server (Vite plugin middleware)
 * and the production Vercel function (api/tmdb/[...path].ts), so the two paths
 * cannot drift apart.
 *
 * The TMDB key is read from the *server* environment (TMDB_API_KEY) and never
 * from a VITE_-prefixed variable, so it is not inlined into the client bundle.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

const UPSTREAM = 'https://api.themoviedb.org/3';
const ALLOWED_PATH = /^\/[a-z0-9_]+\/[a-z0-9_]+(\/[a-z0-9_.-]+)*$/i;
const CACHE_TTL_SECONDS = 60 * 60;

interface ProxyResult {
  status: number;
  body: string;
  contentType: string;
  cacheControl?: string;
}

async function proxyTmdb(req: IncomingMessage): Promise<ProxyResult> {
  const url = new URL(req.url || '/', 'http://localhost');
  // The client calls `/api/tmdb/<path>` on the app host, but the upstream
  // expects `<path>` only — without stripping the mount prefix every request
  // would be forwarded to `https://api.themoviedb.org/3/api/tmdb/...` and 404.
  const pathname = url.pathname.replace(/^\/api\/tmdb/, '');

  // Only forward ordinary resource paths — never an arbitrary URL.
  if (!ALLOWED_PATH.test(pathname) || pathname.includes('..')) {
    return { status: 400, body: JSON.stringify({ error: 'Invalid TMDB path' }), contentType: 'application/json' };
  }

  const key = process.env.TMDB_API_KEY;
  if (!key) {
    return { status: 503, body: JSON.stringify({ error: 'TMDB proxy is not configured' }), contentType: 'application/json' };
  }

  // Never trust a client-supplied key: always use the server-side one.
  url.searchParams.set('api_key', key);

  try {
    const upstream = await fetch(`${UPSTREAM}${pathname}?${url.searchParams.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    const body = await upstream.text();
    return {
      status: upstream.status,
      body,
      contentType: upstream.headers.get('content-type') || 'application/json',
      cacheControl: upstream.ok
        ? `public, max-age=0, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=86400`
        : undefined,
    };
  } catch {
    return { status: 502, body: JSON.stringify({ error: 'TMDB upstream request failed' }), contentType: 'application/json' };
  }
}

/** Node (Connect) middleware used by the Vite dev server. */
export function tmdbProxyMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const pathname = (req.url || '').split('?')[0];
    if (!pathname.startsWith('/api/tmdb/')) {
      next();
      return;
    }

    const result = await proxyTmdb(req);
    if (result.cacheControl) res.setHeader('Cache-Control', result.cacheControl);
    res.setHeader('Content-Type', result.contentType);
    res.statusCode = result.status;
    res.end(req.method === 'HEAD' ? undefined : result.body);
  };
}

export { proxyTmdb };
