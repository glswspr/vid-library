import { extractImdbId } from '../utils/imdb';
import { TMDB_API_KEY, FALLBACK_TMDB_API_KEY, canUseTmdb, tmdbFetchJson, tmdbDirectUrl } from './config';
import type { SearchResult } from './search';

/**
 * Resolve a direct IMDb ID input (raw ID or full URL).
 * Returns a SearchResult if valid, null otherwise.
 */
export function resolveDirectImdbId(input: string): SearchResult | null {
  const imdbId = extractImdbId(input);
  if (!imdbId) return null;

  return {
    imdbId,
    title: imdbId.toUpperCase(),
    type: 'movie',
  };
}

/**
 * Look up metadata from Wikidata using an IMDb ID.
 * Uses haswbstatement search to find the entity by IMDb property P345.
 * Returns title, year, seasons count, and episode count.
 */
export async function resolveImdbTitle(imdbId: string, signal?: AbortSignal): Promise<{
  title: string;
  year?: string;
  seasonsCount?: number;
  episodesCount?: number;
} | null> {
  try {
    // Step 1: find Wikidata entity by IMDb ID property
    const searchUrl = `https://www.wikidata.org/w/api.php?action=query&list=search&srsearch=haswbstatement:P345=${encodeURIComponent(imdbId)}&format=json&origin=*`;
    const searchRes = await fetch(searchUrl, { signal });
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const pages = searchData?.query?.search || [];
    if (pages.length === 0) return null;
    const qid = pages[0].title;

    // Step 2: get label, year, season count, episode count, and Wikipedia link
    const claimsUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=labels|claims|sitelinks&languages=en&format=json&origin=*`;
    const claimsRes = await fetch(claimsUrl, { signal });
    if (!claimsRes.ok) return null;
    const claimsData = await claimsRes.json();
    const entity = claimsData?.entities?.[qid];
    // Prefer labels, fall back to P1476 (title) property when labels are empty
    const label = entity?.labels?.en?.value
      || entity?.claims?.P1476?.[0]?.mainsnak?.datavalue?.value?.text;

    let year: string | undefined;
    if (entity?.claims?.P577) {
      const rawTime = entity.claims.P577[0]?.mainsnak?.datavalue?.value?.time;
      if (rawTime) {
        const m = (rawTime as string).match(/^\+?(\d{4})/);
        if (m) year = m[1];
      }
    }
    // Also try P580 (start time) for TV shows when P577 is missing
    if (!year && entity?.claims?.P580) {
      const rawTime = entity.claims.P580[0]?.mainsnak?.datavalue?.value?.time;
      if (rawTime) {
        const m = (rawTime as string).match(/^\+?(\d{4})/);
        if (m) year = m[1];
      }
    }

    // P2437 = number of seasons, P1113 = number of episodes
    let seasonsCount: number | undefined;
    let episodesCount: number | undefined;
    const sc = entity?.claims?.P2437?.[0]?.mainsnak?.datavalue?.value;
    const ec = entity?.claims?.P1113?.[0]?.mainsnak?.datavalue?.value;
    seasonsCount = typeof sc === 'number' ? sc : undefined;
    episodesCount = typeof ec === 'number' ? ec : undefined;

    // Fallback: try Wikipedia infobox if Wikidata doesn't have episode counts
    const enwikiTitle = entity?.sitelinks?.enwiki?.title;
    if ((!seasonsCount || !episodesCount) && enwikiTitle) {
      try {
        const wpUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(enwikiTitle)}&prop=wikitext&format=json&origin=*`;
        const wpRes = await fetch(wpUrl, { signal });
        if (wpRes.ok) {
          const wpData = await wpRes.json();
          const wikitext: string = wpData?.parse?.wikitext?.['*'] || '';
          if (!seasonsCount) {
            const sm = wikitext.match(/\|\s*num_seasons\s*=\s*(\d+)/i);
            if (sm) seasonsCount = parseInt(sm[1], 10);
          }
          if (!episodesCount) {
            const em = wikitext.match(/\|\s*num_episodes\s*=\s*(\d+)/i);
            if (em) episodesCount = parseInt(em[1], 10);
          }
        }
      } catch { /* Wikipedia fallback failed, use what we have */ }
    }

    return {
      title: label || imdbId,
      year,
      seasonsCount,
      episodesCount,
    };
  } catch {
    return null;
  }
}

interface TmdbFindResult {
  movie_results?: { id: number; poster_path?: string | null; backdrop_path?: string | null }[];
  tv_results?: { id: number; poster_path?: string | null; backdrop_path?: string | null }[];
}

export interface TmdbResolved {
  id: string;
  posterPath?: string;
  backdropPath?: string;
}

// Module-level cache for IMDb → TMDB lookups (24h TTL) so re-visiting a title
// doesn't keep hitting TMDB's rate limits (mirrors vidsrc-addon's caching).
const tmdbIdCache = new Map<string, { value: TmdbResolved | null; at: number }>();
const TMDB_ID_CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * Detect whether an IMDb ID corresponds to a movie or a TV show, using
 * TMDB's find endpoint which returns separate movie/tv result buckets.
 * Returns null if TMDB can't determine the type.
 */
export async function detectMediaType(
  imdbId: string,
  signal?: AbortSignal,
): Promise<'movie' | 'tv' | null> {
  const keys = TMDB_API_KEY
    ? [TMDB_API_KEY, FALLBACK_TMDB_API_KEY]
    : [FALLBACK_TMDB_API_KEY];
  // Direct requests need a non-empty key: `tmdbDirectUrl` returns '' without
  // one, and `fetch('')` would request the current page instead.
  const usable = keys.filter((k) => Boolean(k) && canUseTmdb(k));
  if (usable.length === 0) return null;

  for (const key of usable) {
    try {
      const res = await fetch(tmdbDirectUrl(`/find/${encodeURIComponent(imdbId)}?external_source=imdb_id`, key), { signal });
      if (!res.ok) continue;
      const data: TmdbFindResult = await res.json();
      const hasMovie = (data.movie_results?.length ?? 0) > 0;
      const hasTv = (data.tv_results?.length ?? 0) > 0;
      if (hasMovie && !hasTv) return 'movie';
      if (hasTv && !hasMovie) return 'tv';
      if (hasTv && hasMovie) return 'tv';
    } catch (e) {
      console.warn(`TMDB type detect failed for ${imdbId}:`, e);
    }
  }
  return null;
}

/**
 * Resolve a TMDB numeric ID from either an IMDb ID (tt...) or a numeric TMDB ID.
 * If the input is already a numeric TMDB ID, it's returned directly.
 * Otherwise, uses TMDB's find API to convert IMDb ID to TMDB ID.
 */
export async function resolveTmdbId(
  id: string,
  type: 'movie' | 'tv',
  signal?: AbortSignal,
): Promise<TmdbResolved | null> {
  if (!id.startsWith('tt') && /^\d+$/.test(id)) {
    return { id, posterPath: undefined, backdropPath: undefined };
  }
  return resolveTmdbFromImdb(id, type, signal);
}

/**
 * Resolve a TMDB numeric ID from an IMDb ID using TMDB's find API.
 * Prefers the app's own VITE_TMDB_API_KEY and falls back to the bundled
 * public key. Returns null if unresolvable.
 */
export async function resolveTmdbFromImdb(
  imdbId: string,
  type: 'movie' | 'tv',
  signal?: AbortSignal,
): Promise<TmdbResolved | null> {
  const cacheKey = `${type}:${imdbId}`;
  const cached = tmdbIdCache.get(cacheKey);
  if (cached && Date.now() - cached.at < TMDB_ID_CACHE_TTL) return cached.value;

  const keys = TMDB_API_KEY
    ? [TMDB_API_KEY, FALLBACK_TMDB_API_KEY]
    : [FALLBACK_TMDB_API_KEY];
  const usable = keys.filter((k) => Boolean(k) && canUseTmdb(k));
  if (usable.length === 0) return null;

  for (const key of usable) {
    try {
      const res = await fetch(tmdbDirectUrl(`/find/${encodeURIComponent(imdbId)}?external_source=imdb_id`, key), { signal });
      if (!res.ok) continue;
      const data: TmdbFindResult = await res.json();
      const movie = data.movie_results?.[0];
      const show = data.tv_results?.[0];
      const result = type === 'tv' ? show ?? movie : movie ?? show;
      if (!result) continue;
      const value: TmdbResolved = {
        id: result.id.toString(),
        posterPath: result.poster_path || undefined,
        backdropPath: result.backdrop_path || undefined,
      };
      tmdbIdCache.set(cacheKey, { value, at: Date.now() });
      return value;
    } catch (e) {
      console.warn(`TMDB find lookup failed for ${imdbId}:`, e);
    }
  }
  tmdbIdCache.set(cacheKey, { value: null, at: Date.now() });
  return null;
}

/**
 * Fetch the title for a media ID (IMDB or TMDB).
 * Uses TMDB API for both ID types, with Wikidata fallback for IMDB IDs.
 */
export async function fetchTitle(
  id: string,
  type: 'movie' | 'tv',
  signal?: AbortSignal,
): Promise<string | null> {
  const tmdb = await resolveTmdbId(id, type, signal);
  if (tmdb) {
    const tmdbKey = TMDB_API_KEY || FALLBACK_TMDB_API_KEY;
    if (canUseTmdb(tmdbKey)) {
      try {
        const data = await tmdbFetchJson(`/${type}/${tmdb.id}`, tmdbKey, signal) as Record<string, any> | null;
        if (data?.name || data?.title) {
          return data.name || data.title;
        }
      } catch {
        // fall through to Wikidata fallback for IMDB IDs
      }
    }
  }

  // For numeric TMDB IDs, try to resolve to IMDb ID then use Wikidata
  if (!id.startsWith('tt') && /^\d+$/.test(id)) {
    const imdbId = await resolveImdbFromTmdb(id, type, signal);
    if (imdbId) {
      const resolved = await resolveImdbTitle(imdbId, signal);
      if (resolved?.title && resolved.title !== imdbId) {
        return resolved.title;
      }
    }
  }

  if (id.startsWith('tt')) {
    const resolved = await resolveImdbTitle(id, signal);
    if (resolved?.title && resolved.title !== id) {
      return resolved.title;
    }
  }

  return null;
}

/**
 * Resolve an IMDb ID from a numeric TMDB ID using TMDB's external_ids endpoint.
 */
async function resolveImdbFromTmdb(
  tmdbId: string,
  type: 'movie' | 'tv',
  signal?: AbortSignal,
): Promise<string | null> {
  const tmdbKey = TMDB_API_KEY || FALLBACK_TMDB_API_KEY;
  if (!canUseTmdb(tmdbKey)) return null;

  try {
    const data = await tmdbFetchJson(`/${type}/${tmdbId}/external_ids`, tmdbKey, signal) as Record<string, any> | null;
    return data?.imdb_id || null;
  } catch {
    return null;
  }
}

/**
 * Fetch authoritative per-season episode counts from Wikipedia.
 *
 * Resolves IMDb ID → Wikidata QID → enwiki sitelink, then parses the
 * "List of {title} episodes" page's `{{Series overview}}` template for
 * `|episodesN = NN` fields. This is the only source that correctly counts
 * double-length finale episodes as two entries (e.g. Friends S7 = 24 while
 * both 2embed and TMDB report 23).
 *
 * Returns a Map of season number → episode count, or null if unavailable.
 */
export async function fetchWikipediaEpisodeCounts(
  imdbId: string,
): Promise<Map<number, number> | null> {
  try {
    // Step 1: resolve IMDb → QID viaWikidata search by IMDb property
    const searchUrl = `https://www.wikidata.org/w/api.php?action=query&list=search&srsearch=haswbstatement:P345=${encodeURIComponent(imdbId)}&format=json&origin=*`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const pages = searchData?.query?.search || [];
    if (pages.length === 0) return null;
    const qid = pages[0].title;

    // Step 2: get enwiki sitelink title for the main article
    const claimsUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(qid)}&props=sitelinks&languages=en&format=json&origin=*`;
    const claimsRes = await fetch(claimsUrl);
    if (!claimsRes.ok) return null;
    const claimsData = await claimsRes.json();
    const entity = claimsData?.entities?.[qid];
    const enwikiTitle = entity?.sitelinks?.enwiki?.title;
    if (!enwikiTitle) return null;

    // Step 3: fetch the "List of {title} episodes" page wikitext
    const listPageTitle = `List of ${enwikiTitle} episodes`;
    const wpUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(listPageTitle)}&prop=wikitext&format=json&origin=*`;
    const wpRes = await fetch(wpUrl);
    if (!wpRes.ok) return null;
    const wpData = await wpRes.json();
    const wikitext: string = wpData?.parse?.wikitext?.['*'] || '';

    // Step 4: parse |episodesN = NN from the Series overview template
    const counts = new Map<number, number>();
    const regex = /\| *episodes *(\d+) *= *(\d+)/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(wikitext)) !== null) {
      const season = parseInt(match[1], 10);
      const count = parseInt(match[2], 10);
      if (season > 0 && count > 0) {
        counts.set(season, count);
      }
    }

    // Fallback: try |num_episodesN = NN pattern (used by some list pages)
    if (counts.size === 0) {
      const regex2 = /\| *num_episodes *(\d+) *= *(\d+)/gi;
      while ((match = regex2.exec(wikitext)) !== null) {
        const season = parseInt(match[1], 10);
        const count = parseInt(match[2], 10);
        if (season > 0 && count > 0) {
          counts.set(season, count);
        }
      }
    }

    return counts.size > 0 ? counts : null;
  } catch {
    return null;
  }
}

export interface WikipediaEpisodeDetail {
  episodeNumber: number;
  title: string;
  summary?: string;
}

/**
 * Resolve an IMDb ID to the enwiki article title via Wikidata.
 * Cached at module level to avoid redundant lookups when fetching per-season
 * episode details for multiple seasons of the same show.
 */
const enwikiTitleCache = new Map<string, { value: string | null; at: number }>();
const ENWIKI_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

async function resolveEnwikiTitle(imdbId: string): Promise<string | null> {
  const cached = enwikiTitleCache.get(imdbId);
  if (cached && Date.now() - cached.at < ENWIKI_CACHE_TTL) return cached.value;

  try {
    const searchUrl = `https://www.wikidata.org/w/api.php?action=query&list=search&srsearch=haswbstatement:P345=${encodeURIComponent(imdbId)}&format=json&origin=*`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const pages = searchData?.query?.search || [];
    if (pages.length === 0) return null;
    const qid = pages[0].title;

    const claimsUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(qid)}&props=sitelinks&languages=en&format=json&origin=*`;
    const claimsRes = await fetch(claimsUrl);
    if (!claimsRes.ok) return null;
    const claimsData = await claimsRes.json();
    const enwikiTitle = claimsData?.entities?.[qid]?.sitelinks?.enwiki?.title || null;
    enwikiTitleCache.set(imdbId, { value: enwikiTitle, at: Date.now() });
    return enwikiTitle;
  } catch {
    enwikiTitleCache.set(imdbId, { value: null, at: Date.now() });
    return null;
  }
}

/**
 * Extract a balanced template invocation from wikitext starting at the given
 * search index (which points to the `{{` of the template).
 * Returns {content, endIndex} where content is the text between `{{TemplateName`
 * and the matching `}}`, or null if unbalanced.
 */
function extractTemplateBlock(wikitext: string, startIdx: number): { content: string; endIndex: number } | null {
  let depth = 1;
  let i = startIdx + 2;
  while (depth > 0 && i < wikitext.length) {
    if (wikitext[i] === '{' && wikitext[i + 1] === '{') {
      depth++;
      i += 2;
    } else if (wikitext[i] === '}' && wikitext[i + 1] === '}') {
      depth--;
      if (depth === 0) return { content: wikitext.slice(startIdx + 2, i), endIndex: i + 2 };
      i += 2;
    } else {
      i++;
    }
  }
  return null;
}

/**
 * Parse a parameter value from a wikitext template content string.
 * Only matches `|` at the start of a line to avoid matching parameters
 * inside nested templates like `{{cite web|title=...}}`.
 */
function parseTemplateField(content: string, fieldName: string): string | undefined {
  const regex = new RegExp(`(?:^|\\n)\\|\\s*${fieldName}\\s*=([\\s\\S]*?)(?=\\n\\||\\n\\}\\})`, 'i');
  const match = regex.exec(content);
  return match ? match[1].trim() : undefined;
}

/**
 * Fetch per-episode details (title + summary) from the Wikipedia season page.
 * The season page title follows the pattern "{enwikiTitle} season {N}", e.g.
 * "Friends season 7". Episode data comes from `{{Episode list}}` and
 * `{{Episode list/sublist}}` (multi-part) template invocations.
 *
 * Returns a Map of season episode number → {title, summary}, or null.
 */
export async function fetchWikipediaSeasonEpisodeDetails(
  imdbId: string,
  seasonNumber: number,
): Promise<Map<number, WikipediaEpisodeDetail> | null> {
  try {
    const enwikiTitle = await resolveEnwikiTitle(imdbId);
    if (!enwikiTitle) return null;

    const seasonPageTitle = `${enwikiTitle} season ${seasonNumber}`;
    const wpUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(seasonPageTitle)}&prop=wikitext&format=json&origin=*`;
    const wpRes = await fetch(wpUrl);
    if (!wpRes.ok) return null;
    const wpData = await wpRes.json();
    const wikitext: string = wpData?.parse?.wikitext?.['*'] || '';
    if (!wikitext) return null;

    const episodes = new Map<number, WikipediaEpisodeDetail>();
    const marker = '{{Episode list';
    let idx = 0;

    while (true) {
      const startIdx = wikitext.indexOf(marker, idx);
      if (startIdx === -1) break;

      const block = extractTemplateBlock(wikitext, startIdx);
      if (!block) {
        idx = startIdx + 1;
        continue;
      }
      idx = block.endIndex;
      const content = block.content;

      const title = parseTemplateField(content, 'Title') || '';
      const summary = parseTemplateField(content, 'ShortSummary');
      const cleanedTitle = title.replace(/\[+|\]/g, '').replace(/''|''/g, '');

      if (!cleanedTitle) continue;

      // Single-part episode: |EpisodeNumber2 = N
      const singleNum = parseTemplateField(content, 'EpisodeNumber2');
      if (singleNum) {
        const epNum = parseInt(singleNum, 10);
        if (!isNaN(epNum) && epNum > 0) {
          episodes.set(epNum, {
            episodeNumber: epNum,
            title: cleanedTitle,
            summary,
          });
        }
        continue;
      }

      // Multi-part episode: |EpisodeNumber2_1 = N, |EpisodeNumber2_2 = M
      for (let part = 1; part <= 5; part++) {
        const field = parseTemplateField(content, `EpisodeNumber2_${part}`);
        if (field) {
          const epNum = parseInt(field, 10);
          if (!isNaN(epNum) && epNum > 0) {
            episodes.set(epNum, {
              episodeNumber: epNum,
              title: cleanedTitle,
              summary,
            });
          }
        }
      }
    }

    return episodes.size > 0 ? episodes : null;
  } catch {
    return null;
  }
}

/** Best-effort poster URL for an IMDb ID (CORS-friendly TMDB lookup). */
export async function resolvePosterUrl(
  imdbId: string,
  type: 'movie' | 'tv',
): Promise<string | undefined> {
  const tmdb = await resolveTmdbFromImdb(imdbId, type);
  return tmdb?.posterPath
    ? `https://image.tmdb.org/t/p/w500${tmdb.posterPath}`
    : undefined;
}

const tmdbRatingCache = new Map<string, { value: string | null; at: number }>();
const tmdbGenreCache = new Map<string, { value: string | null; at: number }>();
const TMDB_RATING_CACHE_TTL = 24 * 60 * 60 * 1000;

// Shared cache for TMDB detail responses (rating + genres come from the same
// endpoint), so genre lookups don't duplicate rating lookups' requests.
interface TmdbDetailsCached {
  rating?: string;
  genre?: string;
  at: number;
}
const tmdbDetailsCache = new Map<string, TmdbDetailsCached>();

async function fetchTmdbDetailsCached(
  tmdbId: string,
  type: 'movie' | 'tv',
): Promise<TmdbDetailsCached | null> {
  const cacheKey = `${type}:${tmdbId}`;
  const cached = tmdbDetailsCache.get(cacheKey);
  if (cached && Date.now() - cached.at < TMDB_RATING_CACHE_TTL) return cached;

  const key = TMDB_API_KEY || FALLBACK_TMDB_API_KEY;
  if (!canUseTmdb(key)) return null;

  try {
    const data = await tmdbFetchJson(`/${type}/${tmdbId}`, key) as
      { vote_average?: number; genres?: { name: string }[] } | null;
    if (!data) return null;
    const value: TmdbDetailsCached = {
      rating: data.vote_average ? data.vote_average.toFixed(1) : undefined,
      genre: Array.isArray(data.genres) && data.genres.length > 0
        ? data.genres.map((g) => g.name).join(', ')
        : undefined,
      at: Date.now(),
    };
    tmdbDetailsCache.set(cacheKey, value);
    return value;
  } catch {
    return null;
  }
}

export async function fetchTmdbRating(
  imdbId: string,
  type: 'movie' | 'tv',
): Promise<string | undefined> {
  const cacheKey = `${type}:${imdbId}`;
  const cached = tmdbRatingCache.get(cacheKey);
  if (cached && Date.now() - cached.at < TMDB_RATING_CACHE_TTL) return cached.value ?? undefined;

  const tmdb = await resolveTmdbFromImdb(imdbId, type);
  if (!tmdb) {
    tmdbRatingCache.set(cacheKey, { value: null, at: Date.now() });
    return undefined;
  }

  const details = await fetchTmdbDetailsCached(tmdb.id, type);
  const rating = details?.rating;
  tmdbRatingCache.set(cacheKey, { value: rating ?? null, at: Date.now() });
  return rating;
}

/** Best-effort comma-separated genre list for an IMDb ID (cached TMDB detail). */
export async function fetchTmdbGenre(
  imdbId: string,
  type: 'movie' | 'tv',
): Promise<string | undefined> {
  const cacheKey = `${type}:${imdbId}`;
  const cached = tmdbGenreCache.get(cacheKey);
  if (cached && Date.now() - cached.at < TMDB_RATING_CACHE_TTL) return cached.value ?? undefined;

  const tmdb = await resolveTmdbFromImdb(imdbId, type);
  if (!tmdb) {
    tmdbGenreCache.set(cacheKey, { value: null, at: Date.now() });
    return undefined;
  }

  const details = await fetchTmdbDetailsCached(tmdb.id, type);
  const genre = details?.genre;
  tmdbGenreCache.set(cacheKey, { value: genre ?? null, at: Date.now() });
  return genre;
}
