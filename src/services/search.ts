import { TMDB_API_KEY, OMDB_API_KEY, FALLBACK_TMDB_API_KEY, canUseTmdb, tmdbDirectUrl } from './config';
import { getMovieGenres } from './rows';

export interface SearchResult {
  imdbId: string;
  title: string;
  year?: string;
  type: 'movie' | 'tv' | 'person';
  posterUrl?: string;
  rating?: string;
  known_for_department?: string;
  known_for?: SearchResult[];
  /** TMDB entity id for person credits lookups */
  tmdbId?: number;
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
 * Genre alias map for common shorthands (case-insensitive).
 */
const GENRE_ALIASES: Record<string, string> = {
  'sci-fi': 'Science Fiction',
  'sci fi': 'Science Fiction',
  'scifi': 'Science Fiction',
  'action': 'Action',
  'adventure': 'Adventure',
  'animation': 'Animation',
  'anime': 'Animation',
  'comedy': 'Comedy',
  'crime': 'Crime',
  'documentary': 'Documentary',
  'drama': 'Drama',
  'family': 'Family',
  'fantasy': 'Fantasy',
  'history': 'History',
  'horror': 'Horror',
  'music': 'Music',
  'musical': 'Music',
  'mystery': 'Mystery',
  'romance': 'Romance',
  'romantic': 'Romance',
  'science fiction': 'Science Fiction',
  'thriller': 'Thriller',
  'war': 'War',
  'western': 'Western',
  'reality': 'Reality',
  'reality tv': 'Reality',
  'talk': 'Talk',
  'talk show': 'Talk',
  'news': 'News',
  'soap': 'Soap',
  'kids': 'Family',
  'children': 'Family',
};

/**
 * Try to match `query` against a known genre name or alias.
 * Returns the genre id if found, undefined otherwise.
 */
function matchGenreName(query: string, genres: { id: number; name: string }[]): number | undefined {
  const normalized = query.toLowerCase().trim();
  // Direct match first
  const direct = genres.find(g => g.name.toLowerCase() === normalized);
  if (direct) return direct.id;
  // Alias lookup
  const alias = GENRE_ALIASES[normalized];
  if (alias) {
    const aliased = genres.find(g => g.name.toLowerCase() === alias.toLowerCase());
    if (aliased) return aliased.id;
  }
  return undefined;
}

/**
 * Search for movies, TV shows, people, genres, and characters.
 *
 * Order:
 *   1. TMDB search/multi — richest results (posters, ratings, people)
 *   2. Wikidata — free, CORS-friendly, no key
 *   3. OMDb — requires free API key
 *   4. Genre discover — if the query is a genre name/alias, return popular
 *      movies/TV of that genre (only after title search, so exact titles win)
 *   5. Wikidata entity search — characters, landmarks, etc.
 *
 * Each step is isolated so a failure never breaks the next one.
 *
 * `signal` aborts the in-flight request so a newer keystroke supersedes it.
 */
export async function searchByTitle(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery || cleanQuery.length < 2) return [];

  // 1. TMDB — richest results incl. posters (title search first)
  const tmdbResults = await searchTmdb(cleanQuery, signal);
  if (tmdbResults.length > 0) return tmdbResults;

  // 2. Wikidata — free, CC0 data, CORS-friendly
  const wikidataResults = await searchWikidata(cleanQuery, signal);
  if (wikidataResults.length > 0) return wikidataResults;

  // 3. OMDb — requires free API key
  const omdbResults = await searchOmdb(cleanQuery, signal);
  if (omdbResults.length > 0) return omdbResults.slice(0, 15);

  // 4. Genre discover — if the query is a genre name or alias, fetch
  //    popular movies/TV of that genre (after title search so exact
  //    titles like "Action" or "Horror" win over genre lists).
  try {
    const genres = await getMovieGenres();
    const genreId = matchGenreName(cleanQuery, genres);
    if (genreId !== undefined) {
      const discoverResults = await searchDiscoverByGenre(genreId, signal);
      if (discoverResults.length > 0) return discoverResults;
    }
  } catch (e) {
    if (isAbort(e)) throw e;
    /* ignore genre detection errors */
  }

  // 5. Wikidata entity search (characters, landmarks, etc.) — last resort
  const entityResults = await searchWikidataEntities(cleanQuery, signal);
  if (entityResults.length > 0) return entityResults;

  return [];
}

async function searchDiscoverByGenre(genreId: number, signal?: AbortSignal): Promise<SearchResult[]> {
  const tmdbKey = TMDB_API_KEY || FALLBACK_TMDB_API_KEY;
  if (!tmdbKey || !canUseTmdb(tmdbKey)) return [];

  try {
    const params = new URLSearchParams({
      sort_by: 'popularity.desc',
      with_genres: String(genreId),
      'vote_average.gte': '6.0',
      'vote_count.gte': '500',
      page: '1',
    });
    if (tmdbKey) params.set('api_key', tmdbKey);

    // Fetch both movies and TV for the genre (TMDB genre IDs are shared)
    const [movieRes, tvRes] = await Promise.all([
      fetch(tmdbDirectUrl(`/discover/movie?${params.toString()}`, tmdbKey), { signal }),
      fetch(tmdbDirectUrl(`/discover/tv?${params.toString()}`, tmdbKey), { signal }),
    ]);
    if (!movieRes.ok && !tvRes.ok) return [];

    const movieData = movieRes.ok ? await movieRes.json() : { results: [] };
    const tvData = tvRes.ok ? await tvRes.json() : { results: [] };

    const movieItems = (movieData.results || []).slice(0, 8);
    const tvItems = (tvData.results || []).slice(0, 8);

    const results: SearchResult[] = [];

    // Process movies
    for (const item of movieItems) {
      let imdbId: string | undefined;
      try {
        const extRes = await fetch(tmdbDirectUrl(`/movie/${item.id}/external_ids`, tmdbKey), { signal });
        if (extRes.ok) imdbId = (await extRes.json()).imdb_id || undefined;
      } catch (e) {
        if (isAbort(e)) throw e;
        /* skip */
      }
      if (!imdbId) continue;
      results.push({
        imdbId,
        title: item.title || 'Untitled',
        year: (item.release_date || '').substring(0, 4) || undefined,
        type: 'movie' as const,
        posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w92${item.poster_path}` : undefined,
        rating: item.vote_average ? item.vote_average.toFixed(1) : undefined,
      });
    }

    // Process TV shows
    for (const item of tvItems) {
      let imdbId: string | undefined;
      try {
        const extRes = await fetch(tmdbDirectUrl(`/tv/${item.id}/external_ids`, tmdbKey), { signal });
        if (extRes.ok) imdbId = (await extRes.json()).imdb_id || undefined;
      } catch (e) {
        if (isAbort(e)) throw e;
        /* skip */
      }
      if (!imdbId) continue;
      results.push({
        imdbId,
        title: item.name || 'Untitled',
        year: (item.first_air_date || '').substring(0, 4) || undefined,
        type: 'tv' as const,
        posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w92${item.poster_path}` : undefined,
        rating: item.vote_average ? item.vote_average.toFixed(1) : undefined,
      });
    }

    return results;
  } catch (e) {
    if (isAbort(e)) throw e;
    console.warn('Genre discover search failed:', e);
    return [];
  }
}

/**
 * Fetch combined credits for a person (movies + TV) via TMDB.
 * Returns SearchResult[] for their filmography, each with a valid IMDb id.
 */
export async function searchPersonCredits(personTmdbId: number, signal?: AbortSignal): Promise<SearchResult[]> {
  const tmdbKey = TMDB_API_KEY || FALLBACK_TMDB_API_KEY;
  if (!tmdbKey || !canUseTmdb(tmdbKey)) return [];

  try {
    const res = await fetch(tmdbDirectUrl(`/person/${personTmdbId}/combined_credits`, tmdbKey), { signal });
    if (!res.ok) return [];
    const data = await res.json();
    const cast = (data.cast || []).slice(0, 15);

    // Resolve IMDb IDs for credits in parallel
    const results: SearchResult[] = [];
    const batch = cast.slice(0, 10);
    for (const credit of batch) {
      const mediaType = credit.media_type === 'tv' ? 'tv' : 'movie';
      let imdbId: string | undefined;
      try {
        const extRes = await fetch(tmdbDirectUrl(`/${mediaType}/${credit.id}/external_ids`, tmdbKey), { signal });
        if (extRes.ok) imdbId = (await extRes.json()).imdb_id || undefined;
      } catch (e) {
        if (isAbort(e)) throw e;
        /* skip */
      }
      if (!imdbId) continue;
      results.push({
        imdbId,
        title: credit.title || credit.name || 'Untitled',
        year: (credit.release_date || credit.first_air_date || '').substring(0, 4) || undefined,
        type: mediaType as 'movie' | 'tv',
        posterUrl: credit.poster_path ? `https://image.tmdb.org/t/p/w92${credit.poster_path}` : undefined,
        rating: credit.vote_average ? credit.vote_average.toFixed(1) : undefined,
      });
    }
    return results;
  } catch (e) {
    if (isAbort(e)) throw e;
    console.warn('Person credits search failed:', e);
    return [];
  }
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
      (item: any) => item.media_type === 'movie' || item.media_type === 'tv' || item.media_type === 'person'
    );
    if (items.length === 0) return [];

    // Cap the per-item IMDb lookups so a search stays snappy on TV hardware.
    const results: SearchResult[] = [];
    for (const item of items.slice(0, 8)) {
      if (item.media_type === 'person') {
        results.push({
          imdbId: `tmdb_person:${item.id}`,
          title: item.name || 'Unknown',
          type: 'person',
          tmdbId: item.id,
          known_for_department: item.known_for_department,
          known_for: item.known_for?.slice(0, 3).map((kf: any) => ({
            imdbId: kf.id ? `tmdb:${kf.id}` : 'unknown',
            title: kf.title || kf.name || 'Unknown',
            type: (kf.media_type === 'movie' ? 'movie' : 'tv') as 'movie' | 'tv',
            posterUrl: kf.poster_path ? `https://image.tmdb.org/t/p/w92${kf.poster_path}` : undefined,
          })) || [],
          posterUrl: item.profile_path ? `https://image.tmdb.org/t/p/w92${item.profile_path}` : undefined,
        });
        continue;
      }
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

async function searchWikidataEntities(cleanQuery: string, signal?: AbortSignal): Promise<SearchResult[]> {
  try {
    // Step 1: search for matching Wikidata entities
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(cleanQuery)}&language=en&limit=10&format=json&origin=*`;
    const searchRes = await fetch(searchUrl, { signal });
    if (!searchRes.ok) return [];
    const searchData = await searchRes.json();
    const entities = searchData?.search || [];
    if (entities.length === 0) return [];

    // Step 2: fetch claims to determine type and associated work
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

      let imdbId: string | undefined;
      let type: 'movie' | 'tv' = 'movie';
      let year: string | undefined;

      // Try to get associated work (P361 = part of, P1441 = present in work)
      // Check both: characters often have P361 (franchise) which may lack an
      // IMDb ID, plus P1441 (specific film/episode) which usually has one.
      const partOf = [...(claims.P361 || []), ...(claims.P1441 || [])];
      for (const stmt of partOf) {
        const workQid = stmt?.mainsnak?.datavalue?.value?.id;
        if (workQid) {
          // Fetch the work's claims to get IMDb ID
          try {
            const workUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${workQid}&props=claims&format=json&origin=*`;
            const workRes = await fetch(workUrl, { signal });
            if (workRes.ok) {
              const workData = await workRes.json();
              const workClaims = workData?.entities?.[workQid]?.claims;
              const imdbClaim = workClaims?.P345;
              if (imdbClaim) {
                const potentialId = imdbClaim[0]?.mainsnak?.datavalue?.value;
                if (potentialId && (potentialId as string).startsWith('tt')) {
                  imdbId = potentialId as string;

                  // Determine type
                  const instanceOf = workClaims?.P31 || [];
                  for (const stmt2 of instanceOf) {
                    const qid = stmt2?.mainsnak?.datavalue?.value?.id;
                    if (qid === 'Q5398426' || qid === 'Q15416') {
                      type = 'tv';
                      break;
                    }
                  }

                  // Extract year
                  const pubClaim = workClaims?.P577;
                  if (pubClaim) {
                    const rawTime = pubClaim[0]?.mainsnak?.datavalue?.value?.time;
                    if (rawTime) {
                      const match = (rawTime as string).match(/^\+?(\d{4})/);
                      if (match) year = match[1];
                    }
                  }

                  break; // Found a valid work with IMDb ID
                }
              }
            }
          } catch (e) {
            if (isAbort(e)) throw e;
            /* skip individual work lookups */
          }
        }
      }

      if (!imdbId) continue;

      results.push({
        imdbId,
        title: entity.label || entity.label || entity.title || 'Untitled',
        year,
        type,
      });
    }

    return results;
  } catch (e) {
    if (isAbort(e)) throw e;
    console.warn('Wikidata entity search failed:', e);
    return [];
  }
}

async function searchOmdb(cleanQuery: string, signal?: AbortSignal): Promise<SearchResult[]> {
  // OMDb does not have a multi-result search API: `&s=` returns a list of
  // { Title, Year, imdbID, Type, Poster } which is exactly what we need.
  if (!OMDB_API_KEY) return [];

  try {
    const params = new URLSearchParams({ s: cleanQuery, apikey: OMDB_API_KEY, type: 'movie' });
    const res = await fetch(`https://www.omdbapi.com/?${params.toString()}`, { signal });
    if (!res.ok) return [];

    const data = await res.json();
    if (data.Error) return [];

    return (data.Search || []).map((item: any) => ({
      imdbId: item.imdbID,
      title: item.Title,
      year: item.Year?.substring(0, 4),
      type: (item.Type === 'series' ? 'tv' : 'movie') as 'movie' | 'tv',
      posterUrl: item.Poster && item.Poster !== 'N/A' ? item.Poster : undefined,
    }));
  } catch (e) {
    if (isAbort(e)) throw e;
    console.warn('OMDb search failed:', e);
    return [];
  }
}