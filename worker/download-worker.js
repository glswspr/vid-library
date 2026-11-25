/**
 * VidLibrary download worker.
 *
 * Resolves direct, downloadable file links (MP4/MKV) for a TMDB title and
 * streams them back through this worker, because every upstream CDN either
 * blocks cross-origin reads or requires a Referer that a browser page cannot
 * set.
 *
 * Routes:
 *   GET /resolve?type=movie&tmdb=238
 *   GET /resolve?type=tv&tmdb=1399&season=1&episode=1
 *     -> { sources: [{ provider, quality, format, size, filename, url }] }
 *        `url` points at /dl and is signed, short-lived, and restricted to the
 *        upstream host recorded in the token.
 *   GET /dl?u=<b64url target>&h=<b64url headers>&e=<expiry>&s=<signature>&name=<file>
 *     -> the file itself, with Range passthrough so large downloads resume.
 *
 * Nothing here trusts the caller: /dl only serves URLs this worker itself
 * signed (HMAC over the target, headers and expiry) and only for hosts on the
 * allowlist below, so it cannot be used as an open proxy.
 */

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Each CDN answers differently: hakunaymatata rejects a Chrome User-Agent for
 * VidLink links (`428`) but requires one plus a Referer for MovieBox links,
 * while VidVault's worker needs Chrome UA + Referer and 403s without them.
 * So the UA travels with each source instead of being applied blindly.
 *
 * `null` means "do not send a User-Agent at all", which is what VidLink's CDN
 * expects from a download client.
 */
const UA_VARIANT = {
  none: null,
  chrome: USER_AGENT,
};

/** Upstream file hosts we are willing to stream. */
const ALLOWED_HOST_SUFFIXES = [
  'hakunaymatata.com',
  'workers.dev',
  'hscow.com',
  'themoviebox.uk',
];

const TOKEN_TTL_SECONDS = 60 * 30;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const enc = new TextEncoder();

function b64urlEncode(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < view.length; i += 1) binary += String.fromCharCode(view[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return b64urlEncode(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

function isAllowedHost(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:') return false;
    return ALLOWED_HOST_SUFFIXES.some(
      (suffix) => url.hostname === suffix || url.hostname.endsWith(`.${suffix}`),
    );
  } catch {
    return false;
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  });
}

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const gb = n / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  return `${Math.round(n / 1024 ** 2)} MB`;
}

function safeFilename(title, season, episode, quality, extension) {
  const clean = String(title || 'video')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);
  const episodeTag =
    season != null && episode != null
      ? ` S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`
      : '';
  const qualityTag = quality && quality !== 'Auto' ? ` [${quality}]` : '';
  return `${clean || 'video'}${episodeTag}${qualityTag}.${extension}`;
}

/** Absolute worker origin, derived from the request so no env value is needed. */
function originOf(request) {
  return new URL(request.url).origin;
}

async function signedUrl(request, secret, target, headers, filename) {
  const expiry = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const u = b64urlEncode(enc.encode(target));
  const h = b64urlEncode(enc.encode(JSON.stringify(headers || {})));
  const signature = await hmac(secret, `${expiry}\n${u}\n${h}\n${filename}`);
  const params = new URLSearchParams({
    u,
    h,
    e: String(expiry),
    s: signature,
    name: filename,
  });
  return `${originOf(request)}/dl?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// resolvers
// ---------------------------------------------------------------------------

async function fetchJson(url, headers = {}, timeoutMs = 10_000) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...headers },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * VidLink exposes per-quality MP4 files (H.265) with byte sizes. TMDB ids must
 * first be obfuscated through enc-dec.app, exactly as the player does it.
 */
async function resolveVidlink(tmdbId, season, episode) {
  const token = await fetchJson(
    `https://enc-dec.app/api/enc-vidlink?text=${encodeURIComponent(tmdbId)}`,
  );
  const key = token?.result;
  if (!key) return [];

  const path =
    season != null && episode != null
      ? `https://vidlink.pro/api/b/tv/${key}/${season}/${episode}`
      : `https://vidlink.pro/api/b/movie/${key}`;

  const data = await fetchJson(path, {
    Origin: 'https://vidlink.pro',
    Referer: 'https://vidlink.pro/',
  });

  const qualities = data?.stream?.qualities;
  if (!qualities || typeof qualities !== 'object') return [];

  return Object.entries(qualities)
    .filter(([, item]) => item?.url && /\.mp4(\?|$)/i.test(item.url))
    .map(([label, item]) => ({
      provider: 'VidLink',
      quality: `${label}p`,
      format: 'mp4',
      size: formatBytes(item.size),
      sizeBytes: Number(item.size) || undefined,
      target: item.url,
      // Sending any User-Agent gets this CDN to answer 428.
      sourceHeaders: { 'User-Agent': UA_VARIANT.none },
    }));
}

/** MovieBox serves MP4 which needs a Chrome UA plus its playback Referer. */
async function resolveMoviebox(tmdbId, season, episode) {
  const query =
    season != null && episode != null
      ? `type=tv&se=${season}&ep=${episode}`
      : 'type=movie';
  const data = await fetchJson(`https://net79.cc/api/embed-tmdb/${tmdbId}?${query}`, {
    Referer: 'https://net79.cc/',
    Origin: 'https://net79.cc',
  });
  if (!data?.ok) return [];

  // `mode: "proxy"` means the CDN refuses anyone but the provider itself, and
  // the provider publishes a neutral proxy for exactly that case. Using it is
  // the only reliable way to get MovieBox bytes.
  const streams = Array.isArray(data.streams) ? data.streams : [];
  const useProxy = data.mode === 'proxy' && data.source === 'primary';

  return streams
    .filter((item) => typeof item?.url === 'string' && /\.mp4(\?|$)/i.test(item.url))
    .map((item) => ({
      provider: 'MovieBox',
      quality: item.resolution ? `${item.resolution}p` : 'Auto',
      format: 'mp4',
      size: formatBytes(item.size),
      sizeBytes: Number(item.size) || undefined,
      target: useProxy
        ? `https://themoviebox.uk/proxy?url=${encodeURIComponent(item.url)}&referer=${encodeURIComponent('https://videodownloader.site/')}`
        : item.url,
      sourceHeaders: useProxy
        ? { 'User-Agent': UA_VARIANT.chrome, Referer: 'https://themoviebox.uk/' }
        : { 'User-Agent': UA_VARIANT.chrome, Referer: 'https://mzfi.me/' },
    }));
}

/** Quality labels VidVault exposes, used only by the JSON fallback below. */
const VIDVAULT_QUALITIES = ['1080p', '720p', '480p', '360p'];

/**
 * VidVault serves MKV files. Its page lists every quality in one response, so
 * one request is enough — asking its JSON endpoint once per quality tripped the
 * host's rate limiter and made the whole provider vanish.
 */
async function resolveVidvault(tmdbId, season, episode) {
  const type = season != null && episode != null ? 'tv' : 'movie';
  const page =
    type === 'tv'
      ? `https://vidvault.to/tv/${tmdbId}/${season}/${episode}`
      : `https://vidvault.to/movie/${tmdbId}`;

  let html;
  try {
    const res = await fetch(page, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        Referer: 'https://vidvault.to/',
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    html = await res.text();
  } catch {
    return [];
  }

  const sources = [];
  const blockRe = /<div[^>]*class=["'][^"']*quality-item[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
  for (const match of html.matchAll(blockRe)) {
    const block = match[1];
    const href = block.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/i)?.[1];
    if (!href || !isAllowedHost(href)) continue;
    const quality = block.match(/Download\s*([0-9a-zA-Z]+)/i)?.[1] ?? 'Auto';
    const size = block.match(/<small>\(([^)]+)\)<\/small>/i)?.[1];
    sources.push({
      provider: 'VidVault',
      quality,
      format: 'mkv',
      size,
      target: href,
      sourceHeaders: { 'User-Agent': UA_VARIANT.chrome, Referer: 'https://vidvault.to/' },
    });
  }
  if (sources.length > 0) return sources;

  // The page layout is the fragile part, so ask its JSON endpoint as a last
  // resort — one quality only, to stay under the rate limit.
  for (const quality of VIDVAULT_QUALITIES.slice(0, 2)) {
    const data = await fetchJson(
      `https://vidvault.to/download-link/${type}/${tmdbId}${type === 'tv' ? `/${season}/${episode}` : ''}/${quality}`,
      { Referer: 'https://vidvault.to/', Accept: 'application/json' },
      8_000,
    );
    const url = data?.url ? String(data.url).split('?')[0].split('#')[0] : '';
    if (!url || !isAllowedHost(url)) continue;
    return [
      {
        provider: 'VidVault',
        quality,
        format: 'mkv',
        target: url,
        sourceHeaders: { 'User-Agent': UA_VARIANT.chrome, Referer: 'https://vidvault.to/' },
      },
    ];
  }
  return [];
}

const RESOLVERS = [resolveVidlink, resolveMoviebox, resolveVidvault];

/**
 * Ask the CDN for one byte. A candidate is only listed when it answers here,
 * because the same URL can work in a browser and fail from this worker (or the
 * other way round) depending on the caller's network and UA.
 *
 * Each provider is probed once, using its highest quality as the sample: the
 * access rules belong to the host, not the file, so one answer per host is
 * enough, and hammering every quality is what got the host to rate-limit.
 */
async function probeOnce(source, timeoutMs = 6_000) {
  const headers = { Range: 'bytes=0-1' };
  for (const [key, value] of Object.entries(source.sourceHeaders || {})) {
    if (value != null && value !== '') headers[key] = value;
  }
  const res = await fetch(source.target, { headers, signal: AbortSignal.timeout(timeoutMs) });
  const status = res.status;
  await res.body?.cancel();
  return status === 200 || status === 206 ? { ok: true } : { ok: false, status };
}

/**
 * `true` means "willing to offer this". A hard refusal (`403`/`427`/`428`) is
 * a decision about this caller and stays refused. A throttle (`429`), a server
 * error, or a timeout is not proof the file is dead — the CDN simply does not
 * want another probe right now, and the user's own download may well work. So
 * those stay offered rather than hiding a working link.
 */
async function probeTarget(source) {
  let first;
  try {
    first = await probeOnce(source);
  } catch {
    return true;
  }
  if (first.ok) return true;

  const hardRefusal = [403, 404, 410, 427, 428].includes(first.status);
  return !hardRefusal;
}

async function groupByProvider(sources) {
  const groups = new Map();
  for (const source of sources) {
    const list = groups.get(source.provider) || [];
    list.push(source);
    groups.set(source.provider, list);
  }
  return groups;
}

async function probeProviders(sources) {
  const groups = await groupByProvider(sources);
  // One sample per provider, in parallel: the limit is per CDN host, and these
  // are different hosts. Probing every quality of one host in parallel is what
  // tripped its rate limiter earlier.
  const results = await Promise.all(
    [...groups.entries()].map(async ([provider, list]) => [provider, await probeTarget(list[0])]),
  );
  return new Map(results);
}

// ---------------------------------------------------------------------------
// routes
// ---------------------------------------------------------------------------

async function handleResolve(request, env) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type') === 'tv' ? 'tv' : 'movie';
  const tmdbId = (url.searchParams.get('tmdb') || '').replace(/[^0-9]/g, '');
  const season = type === 'tv' ? Number(url.searchParams.get('season')) || 1 : null;
  const episode = type === 'tv' ? Number(url.searchParams.get('episode')) || 1 : null;
  const title = url.searchParams.get('title') || '';
  const debug = url.searchParams.get('key') === env.DOWNLOAD_SECRET;

  if (!tmdbId) return json({ error: 'A numeric TMDB id is required' }, 400);
  if (!env.DOWNLOAD_SECRET) return json({ error: 'Download worker is not configured' }, 503);

  // Every probe costs the CDNs a request, and they rate-limit the Worker's IP
  // long before a human trips anything. Cache the answer at the edge so a
  // title resolved once is served from cache for the next ten minutes. The
  // version in the key keeps an older cache format from being served after
  // this file changes.
  const cache = caches.default;
  const cacheKey = new Request(`${url.toString()}&v=3`);
  if (!debug) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  const settled = await Promise.allSettled(
    RESOLVERS.map((resolve) => resolve(tmdbId, season, episode)),
  );

  const raw = settled
    .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
    .filter((source) => source?.target && isAllowedHost(source.target));

  const resolverReport = settled.map((result, index) => ({
    resolver: RESOLVERS[index].name,
    status: result.status,
    found: result.status === 'fulfilled' ? result.value.length : 0,
    error: result.status === 'rejected' ? String(result.reason) : undefined,
  }));

  // Prove the provider actually serves bytes before offering it. CDNs change
  // their hostile rules by the hour and by the caller's network, so a link that
  // resolves is not a link that downloads.
  const usable = await probeProviders(raw);

  const sources = [];
  for (const source of raw) {
    if (!usable.get(source.provider)) continue;
    const filename = safeFilename(title, season, episode, source.quality, source.format);
    sources.push({
      provider: source.provider,
      quality: source.quality,
      format: source.format,
      size: source.size,
      sizeBytes: source.sizeBytes,
      filename,
      url: await signedUrl(request, env.DOWNLOAD_SECRET, source.target, source.sourceHeaders, filename),
      directUrl: source.target,
    });
  }

  sources.sort((a, b) => (parseInt(b.quality, 10) || 0) - (parseInt(a.quality, 10) || 0));
  const response = json({
    type,
    tmdbId,
    sources,
    ...(debug
      ? {
          debug: {
            resolvers: resolverReport,
            candidates: raw.length,
            providers: [...usable.entries()].map(([provider, ok]) => ({ provider, ok })),
          },
        }
      : {}),
  });

  if (!debug && sources.length > 0) {
    // Cache the resolved list so repeat views do not re-probe the CDNs. Clone
    // first: a Response body can only be read once.
    const cached = new Response(response.clone().body, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        // The CORS header has to survive caching, or the browser rejects the
        // cached copy while the uncached one worked.
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=600, s-maxage=600',
      },
    });
    await cache.put(cacheKey, cached).catch(() => {});
  }
  return response;
}

async function handleDownload(request, env) {
  const url = new URL(request.url);
  const u = url.searchParams.get('u');
  const h = url.searchParams.get('h') || '';
  const expiry = Number(url.searchParams.get('e'));
  const signature = url.searchParams.get('s') || '';
  const name = url.searchParams.get('name') || 'download';

  if (!u || !signature || !Number.isFinite(expiry)) return new Response('Bad request', { status: 400 });
  if (Date.now() / 1000 > expiry) return new Response('Link expired', { status: 410 });
  if (!env.DOWNLOAD_SECRET) return new Response('Not configured', { status: 503 });

  const expected = await hmac(env.DOWNLOAD_SECRET, `${expiry}\n${u}\n${h}\n${name}`);
  if (expected !== signature) return new Response('Bad signature', { status: 403 });

  let target;
  try {
    target = new URL(new TextDecoder().decode(b64urlDecode(u)));
  } catch {
    return new Response('Bad target', { status: 400 });
  }
  if (!isAllowedHost(target.toString())) return new Response('Host not allowed', { status: 403 });

  let extraHeaders = {};
  try {
    extraHeaders = JSON.parse(new TextDecoder().decode(b64urlDecode(h))) || {};
  } catch {
    extraHeaders = {};
  }

  const range = request.headers.get('Range');
  const upstreamHeaders = { Accept: '*/*' };
  for (const [key, value] of Object.entries(extraHeaders)) {
    // `null` means "send no User-Agent at all" (VidLink's CDN answers 428
    // when one is present, including the runtime's default).
    if (value != null && value !== '') upstreamHeaders[key] = value;
  }
  if (range) upstreamHeaders.Range = range;

  const upstream = await fetch(target.toString(), {
    headers: upstreamHeaders,
    redirect: 'follow',
    method: request.method === 'HEAD' ? 'HEAD' : 'GET',
  });

  if (!upstream.ok && upstream.status !== 206) {
    await upstream.body?.cancel();
    return new Response(`Upstream returned ${upstream.status}`, { status: 502 });
  }

  const headers = new Headers({
    'Content-Type': upstream.headers.get('Content-Type') || 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${name.replace(/"/g, '')}"`,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Disposition',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
  });
  for (const header of ['Content-Length', 'Content-Range']) {
    const value = upstream.headers.get(header);
    if (value) headers.set(header, value);
  }

  return new Response(upstream.body, { status: upstream.status, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
          'Access-Control-Allow-Headers': 'Range',
        },
      });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }

    if (url.pathname === '/resolve') return handleResolve(request, env);
    if (url.pathname === '/dl') return handleDownload(request, env);

    // Diagnostics: gated on the secret so this never becomes an open proxy.
    if (url.pathname === '/probe') {
      if (url.searchParams.get('key') !== env.DOWNLOAD_SECRET) {
        return new Response('Forbidden', { status: 403 });
      }
      const target = url.searchParams.get('target');
      if (!target || !isAllowedHost(target)) return json({ error: 'target required' }, 400);
      const referer = url.searchParams.get('referer') || '';
      const headers = referer
        ? { Referer: referer, Origin: referer.replace(/\/$/, '') }
        : {};
      try {
        const res = await fetch(target, {
          headers: { ...headers, Range: 'bytes=0-1023' },
          signal: AbortSignal.timeout(15_000),
        });
        await res.body?.cancel();
        return json({ status: res.status, type: res.headers.get('content-type') });
      } catch (error) {
        return json({ error: error.message });
      }
    }

    if (url.pathname === '/') return json({ ok: true, routes: ['/resolve', '/dl'] });
    return new Response('Not found', { status: 404 });
  },
};
