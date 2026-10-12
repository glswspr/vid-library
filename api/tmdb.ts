/**
 * Server-side TMDB proxy (Vercel Serverless Function).
 *
 * Why this exists: any TMDB key used from a browser is public by construction —
 * Vite inlines `VITE_`-prefixed variables into the JS bundle. This function
 * keeps the real key in a server-side `TMDB_API_KEY` environment variable, so
 * it never reaches visitors, and gives us one place for caching.
 *
 * Usage from the client:  fetch('/api/tmdb/3/movie/603')
 * The same handler backs the local dev server (see server/tmdbProxy.ts).
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { proxyTmdb } from '../server/tmdbProxy.ts';

interface VercelRequest extends IncomingMessage {
  query?: Record<string, string | string[] | undefined>;
}

interface VercelResponse extends ServerResponse {
  status(code: number): VercelResponse;
  json(body: unknown): void;
  send(body: string): void;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const result = await proxyTmdb(req);
  if (result.cacheControl) res.setHeader('Cache-Control', result.cacheControl);
  res.setHeader('Content-Type', result.contentType);
  res.status(result.status).send(result.body);
}
