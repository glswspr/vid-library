import { TMDB_API_KEY, OMDB_API_KEY, FALLBACK_TMDB_API_KEY, canUseTmdb, tmdbDirectUrl } from './config';

export interface SearchResult {
  imdbId: string;
  title: string;
  year?: string;
  type: 'movie' | 'tv';
  posterUrl?: string;
  rating?: string;
}

/**
 * `AbortError` is thrown by an aborted fetch. Callers distinguish it from real
 * failures so a cancelled request is never rendered as "no results".
 */
function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}

export { isAbort };

/**
 * Search for movies and TV shows by title.
 *
 * Primary: TMDB search/multi (rich results incl. posters; works without a
 * user key via the fallback key). Fallback: Wikidata (free, CC0, CORS-friendly),
 * then OMDb (requires a key). Each step is isolated so a failure never breaks
 * the next one.
 *
 * `signal` aborts the in-flight request so a newer keystroke supersedes it.
 */
export async function searchByTitle(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery || cleanQuery.length < 2) return [];

  // 1. TMDB — richest results incl. posters
  const tmdbResults = await searchTmdb(cleanQuery, signal);
  if (tmdbResults.length > 0) return tmdbResults;

  // 2. Wikidata — free, CORS-friendly, no key
  const wikidataResults = await searchWikidata(cleanQuery, signal);
  if (wikidataResults.length > 0) return wikidataResults;

  // 3. OMDb — requires free API key
  const omdbResults = await searchOmdb(cleanQuery, signal);
  if (omdbResults.length > 0) return omdbResults.slice(0, 15);

  return [];
}

async function searchTmdb(cleanQuery: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const tmdbKey = TMDB_API_KEY || FALLBACK_TMDB_API_KEY;
  // Without a key the direct URL builder returns "" and `fetch('')` would hit
  // the page itself, so bail out instead of sending a useless request.
  if (!tmdbKey || !canUseTmdb(tmdbKey)) return [];

  try {
    const searchRes = await fetch(tmdbDirectUrl(`/search/multi?query=${encodeURIComponent(cleanQuery)}&page=1`, tmdbKey), { signal });
    if (!searchRes.ok) return [];

    const data = await searchRes.json();
    const items = (data.results || []).filter(
      (item: any) => item.media_type === 'movie' || item.media_type === 'tv'
    );
    if (items.length === 0) return [];

    // Cap the per-item IMDb lookups so a search stays snappy on TV hardware.
    const results: SearchResult[] = [];
    for (const item of items.slice(0, 8)) {
      let imdbId: string | undefined;
      try {
        const extRes = await fetch(tmdbDirectUrl(`/${item.media_type}/${item.id}/external_ids`, tmdbKey), { signal });
        if (extRes.ok) imdbId = (await extRes.json()).imdb_id || undefined;
      } catch (e) {
        if (isAbort(e)) throw e;
        /* skip */
      }
      if (!imdbId) continue;
      results.push({
        imdbId,
        title: item.title || item.name || 'Untitled',
        year: (item.release_date || item.first_air_date || '').substring(0, 4) || undefined,
        type: item.media_type as 'movie' | 'tv',
        posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w92${item.poster_path}` : undefined,
        rating: (item as any).vote_average ? (item as any).vote_average.toFixed(1) : undefined,
      });
    }
    return results;
  } catch (e) {
    if (isAbort(e)) throw e;
    console.warn('TMDB search failed:', e);
    return [];
  }
}

async function searchWikidata(cleanQuery: string, signal?: AbortSignal): Promise<SearchResult[]> {
  try {
    // Step 1: search for matching Wikidata entities
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(cleanQuery)}&language=en&limit=15&format=json&origin=*`;
    const searchRes = await fetch(searchUrl, { signal });

    if (!searchRes.ok) return [];
    const searchData = await searchRes.json();
    const entities = searchData?.search || [];
    if (entities.length === 0) return [];

    // Step 2: fetch claims (IMDb ID, type, year) for all matched entities
    const entityIds = entities.map((e: any) => e.id).join('|');
    const claimsUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entityIds}&props=claims&format=json&origin=*`;
    const claimsRes = await fetch(claimsUrl, { signal });
    if (!claimsRes.ok) return [];

    const claimsData = await claimsRes.json();
    const entityData = claimsData?.entities || {};

    const results: SearchResult[] = [];

    for (const entity of entities) {
      const claims = entityData[entity.id]?.claims;
      if (!claims) continue;

      // Extract IMDb ID (property P345)
      const imdbClaim = claims.P345;
      if (!imdbClaim) continue;
      const imdbId = imdbClaim[0]?.mainsnak?.datavalue?.value;
      if (!imdbId || !(imdbId as string).startsWith('tt')) continue;

      // Determine type from P31 (instance of)
      // Q11424 = film, Q24869 = feature film → movie
      // Q5398426 = TV series, Q15416 = television program → tv
      let type: 'movie' | 'tv' = 'movie';
      const instanceOf = claims.P31 || [];
      for (const stmt of instanceOf) {
        const qid = stmt?.mainsnak?.datavalue?.value?.id;
        if (qid === 'Q5398426' || qid === 'Q15416') {
          type = 'tv';
          break;
        }
      }

      // Extract year from P577 (publication date)
      let year: string | undefined;
      const pubClaim = claims.P577;
      if (pubClaim) {
        const rawTime = pubClaim[0]?.mainsnak?.datavalue?.value?.time; // "+2001-00-00T00:00:00Z"
        if (rawTime) {
          const match = (rawTime as string).match(/^\+?(\d{4})/);
          if (match) year = match[1];
        }
      }

      results.push({
        imdbId: imdbId as string,
        title: entity.label || entity.title || 'Untitled',
        year,
        type,
      });
    }

    return results;
  } catch (e) {
    if (isAbort(e)) throw e;
    console.warn('Wikidata search failed:', e);
    return [];
  }
}

async function searchOmdb(cleanQuery: string, signal?: AbortSignal): Promise<SearchResult[]> {
  if (!OMDB_API_KEY) return [];

  try {
    const res = await fetch(
      `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&s=${encodeURIComponent(cleanQuery)}`,
      { signal },
    );
    if (!res.ok) return [];

    const data = await res.json();
    if (data.Response !== 'True' || !Array.isArray(data.Search)) return [];

    const results: SearchResult[] = [];
    for (const item of data.Search) {
      const imdbId = item.imdbID;
      if (!imdbId || !imdbId.startsWith('tt')) continue;
      const type = item.Type === 'movie' ? 'movie' as const
        : item.Type === 'series' ? 'tv' as const : null;
      if (!type) continue;
      results.push({
        imdbId,
        title: item.Title || 'Untitled',
        year: item.Year || undefined,
        type,
        posterUrl: item.Poster && item.Poster !== 'N/A' ? item.Poster : undefined,
      });
    }
    return results;
  } catch (e) {
    if (isAbort(e)) throw e;
    console.warn('OMDb search failed:', e);
    return [];
  }
}
