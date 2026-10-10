import type { MediaItem, TVShowDetails, Season, Episode } from '../types';
import {
  fetchMovieDetail,
  fetchShowDetail,
  fetchSeasonEpisodes,
  fetchTmdbTVEpisodes,
} from './embed2';
import { resolveImdbTitle, resolveTmdbFromImdb, fetchWikipediaEpisodeCounts, fetchWikipediaSeasonEpisodeDetails } from './metadata';
import type { WikipediaEpisodeDetail } from './metadata';
import { TMDB_API_KEY, FALLBACK_TMDB_API_KEY } from './config';
import { fetchTmdbSeasonsByTmdbId } from './embed2';

/**
 * Fill in `airDate` for episodes that are missing it by looking up the
 * episode number in TMDB's per-season episode list (which reliably carries
 * air dates). Mutates `seasons` in place.
 */
function enrichAirDates(seasons: Season[], tmdbSeasons: Season[] | null): void {
  if (!tmdbSeasons) return;
  for (const season of seasons) {
    const tmdbSeason = tmdbSeasons.find((ts) => ts.seasonNumber === season.seasonNumber);
    if (!tmdbSeason) continue;
    const tmdbEpMap = new Map(tmdbSeason.episodes.map((e) => [e.episodeNumber, e]));
    for (const ep of season.episodes) {
      if (!ep.airDate) {
        const tmdbEp = tmdbEpMap.get(ep.episodeNumber);
        if (tmdbEp?.airDate) {
          ep.airDate = tmdbEp.airDate;
        }
      }
    }
  }
}

// Media details: 2embed primary, Wikidata + TMDB fallback

/** Fetch full metadata (incl. overview/description) for a numeric TMDB id. */
async function fetchTmdbDetail(
  id: string,
  type: 'movie' | 'tv',
): Promise<MediaItem | null> {
  const tmdbKey = TMDB_API_KEY || FALLBACK_TMDB_API_KEY;
  if (!tmdbKey) return null;
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/${type}/${id}?api_key=${tmdbKey}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      id: data.id.toString(),
      imdbId: data.imdb_id || undefined,
      tmdbId: data.id.toString(),
      title: data.title || data.name || 'Untitled',
      year: (data.release_date || data.first_air_date || '').substring(0, 4) || undefined,
      posterUrl: data.poster_path
        ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
        : undefined,
      backdropUrl: data.backdrop_path
        ? `https://image.tmdb.org/t/p/original${data.backdrop_path}`
        : undefined,
      rating: data.vote_average ? data.vote_average.toFixed(1) : undefined,
      genre: (data.genres || []).map((g: any) => g.name).join(', '),
      type,
      description: data.overview || '',
      seasonsCount: type === 'tv' ? data.number_of_seasons || undefined : undefined,
    };
  } catch (e) {
    console.warn('TMDB details fetch error:', e);
    return null;
  }
}

export async function getMediaDetails(id: string, type: 'movie' | 'tv'): Promise<MediaItem> {
  // 1. IMDb ID — try 2embed first (richest data, no key needed)
  if (id.startsWith('tt')) {
    const detail =
      type === 'movie' ? await fetchMovieDetail(id) : await fetchShowDetail(id);
    if (detail?.title && detail.title !== id) {
      return detail;
    }

    // 2embed failed or returned incomplete — fall back to Wikidata + TMDB
    const timeout = () =>
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
    const [resolved, tmdbResolved] = await Promise.all([
      Promise.race([resolveImdbTitle(id), timeout()]).catch(() => null),
      Promise.race([resolveTmdbFromImdb(id, type), timeout()]).catch(() => null),
    ]);

    if (resolved || tmdbResolved) {
      // Pull full TMDB metadata (incl. overview) so the hero has a
      // description even when 2embed is CORS-blocked from the host.
      const tmdbDetail = tmdbResolved
        ? await fetchTmdbDetail(tmdbResolved.id, type)
        : null;
      return {
        id,
        imdbId: id,
        tmdbId: tmdbResolved?.id || undefined,
        title: resolved?.title || tmdbDetail?.title || id,
        year: resolved?.year || tmdbDetail?.year,
        type,
        seasonsCount: resolved?.seasonsCount || tmdbDetail?.seasonsCount,
        description: tmdbDetail?.description || '',
        rating: tmdbDetail?.rating,
        genre: tmdbDetail?.genre,
        posterUrl:
          tmdbDetail?.posterUrl ||
          (tmdbResolved?.posterPath
            ? `https://image.tmdb.org/t/p/w500${tmdbResolved.posterPath}`
            : undefined),
        backdropUrl:
          tmdbDetail?.backdropUrl ||
          (tmdbResolved?.backdropPath
            ? `https://image.tmdb.org/t/p/w780${tmdbResolved.backdropPath}`
            : undefined),
      };
    }
  }

  // 2. TMDB numeric ID with key (user key, else the shared fallback key)
  if (!id.startsWith('tt')) {
    const tmdbDetail = await fetchTmdbDetail(id, type);
    if (tmdbDetail) return tmdbDetail;
  }

  return {
    id,
    imdbId: id.startsWith('tt') ? id : undefined,
    tmdbId: !id.startsWith('tt') ? id : undefined,
    title: id,
    type,
    description: '',
  };
}

export async function getTVShowDetails(id: string): Promise<TVShowDetails> {
  const base = await getMediaDetails(id, 'tv');
  const imdbId = base.imdbId || id;

  // Try 2embed for real season + episode data
  if (imdbId.startsWith('tt')) {
    const showDetail = await fetchShowDetail(imdbId);
    const seasonsCount = showDetail?.seasonsCount || base.seasonsCount || 1;

    // Fetch episode lists per season from 2embed (up to 30 seasons in parallel),
    // plus a TMDB fallback that carries real per-season episode counts. TMDB is
    // used whenever 2embed has no episode data for a season (e.g. when 2embed is
    // CORS-blocked from the deployed host) — otherwise hardcoded placeholders
    // would show the wrong episode totals (e.g. Friends S2 shows 24, not 12).
    const seasonPromises: Promise<Episode[]>[] = [];
    for (let s = 1; s <= Math.min(seasonsCount, 30); s++) {
      seasonPromises.push(fetchSeasonEpisodes(imdbId, s));
    }
    const [allSeasonEpisodes, tmdbSeasons] = await Promise.all([
      Promise.all(seasonPromises),
      fetchTmdbTVEpisodes(imdbId),
    ]);

    // Build seasons array from 2embed data, falling back to TMDB per season
    const seasonsWithData: Season[] = [];
    for (let s = 1; s <= allSeasonEpisodes.length; s++) {
      const episodes = allSeasonEpisodes[s - 1];
      const tmdbSeason = tmdbSeasons?.find((ts) => ts.seasonNumber === s);

      if (episodes.length > 0) {
        if (tmdbSeason && tmdbSeason.episodeCount > episodes.length) {
          seasonsWithData.push(tmdbSeason);
          continue;
        }
        seasonsWithData.push({
          seasonNumber: s,
          episodeCount: episodes.length,
          episodes,
        });
        continue;
      }

      if (tmdbSeason) {
        seasonsWithData.push(tmdbSeason);
        continue;
      }

      // No episode data for this season from either source — placeholders
      const count = 12;
      seasonsWithData.push({
        seasonNumber: s,
        episodeCount: count,
        episodes: Array.from({ length: count }, (_, i) => ({
          seasonNumber: s,
          episodeNumber: i + 1,
          title: `Episode ${i + 1}`,
        })),
      });
    }

    // If 2embed gave no season data at all, fall back to Wikidata + guesswork
    if (seasonsWithData.length === 0) {
      const resolved = await Promise.race([
        resolveImdbTitle(imdbId),
        new Promise<null>((r) => setTimeout(() => r(null), 7000)),
      ]).catch(() => null);
      const count = resolved?.seasonsCount || base.seasonsCount || 1;
      const totalEpisodes = resolved?.episodesCount || count * 12;

      const perSeason = Math.max(1, Math.floor(totalEpisodes / count));
      const remainder = totalEpisodes - perSeason * count;

      for (let s = 1; s <= count; s++) {
        const epCount = s === count ? perSeason + remainder : perSeason;
        seasonsWithData.push({
          seasonNumber: s,
          episodeCount: epCount,
          episodes: Array.from({ length: epCount }, (_, i) => ({
            seasonNumber: s,
            episodeNumber: i + 1,
            title: `Episode ${i + 1}`,
            overview: `Season ${s} Episode ${i + 1} of ${base.title}`,
          })),
        });
      }
     }

    // Enrich episodes that lack an airDate using TMDB's per-season episode list.
    // 2embed may omit air dates for some episodes, and placeholder/Wikipedia-padded
    // episodes never carry one. TMDB is reliable, so backfill from it here.
    enrichAirDates(seasonsWithData, tmdbSeasons);

    // Wikipedia per-season episode counts — authoritative when both 2embed and
    // TMDB undercount (e.g. Friends S7 = 24 while both APIs report 23 because
    // the double-length finale is counted as one entry).
    const wikiCounts = await Promise.race([
      fetchWikipediaEpisodeCounts(imdbId),
      new Promise<Map<number, number> | null>((r) => setTimeout(() => r(null), 8000)),
    ]).catch(() => null);

    if (wikiCounts) {
      const paddedSeasons: number[] = [];
      for (const season of seasonsWithData) {
        const wikiCount = wikiCounts.get(season.seasonNumber);
        if (wikiCount && wikiCount > season.episodes.length) {
          paddedSeasons.push(season.seasonNumber);
          for (let i = season.episodes.length; i < wikiCount; i++) {
            season.episodes.push({
              seasonNumber: season.seasonNumber,
              episodeNumber: i + 1,
              title: `Episode ${i + 1}`,
            });
          }
          season.episodeCount = wikiCount;
        }
      }

      // Enrich padded episodes with real titles and descriptions from the
      // Wikipedia season page (e.g. Friends S7 ep 24 = "The One with Monica
      // and Chandler's Wedding" with a plot summary).
      for (const seasonNum of paddedSeasons) {
        const season = seasonsWithData.find((s) => s.seasonNumber === seasonNum);
        if (!season) continue;
        const wikiDetails = await Promise.race([
          fetchWikipediaSeasonEpisodeDetails(imdbId, seasonNum),
          new Promise<Map<number, WikipediaEpisodeDetail> | null>((r) => setTimeout(() => r(null), 8000)),
        ]).catch(() => null);
        if (!wikiDetails) continue;

        for (const ep of season.episodes) {
          const detail = wikiDetails.get(ep.episodeNumber);
          if (detail) {
            // Replace placeholder titles (e.g. "Episode 24") with the real
            // Wikipedia title; preserve existing TMDB/2embed titles.
            if (detail.title && ep.title?.startsWith('Episode ')) {
              ep.title = detail.title;
            }
            if (detail.summary && !ep.overview) {
              ep.overview = detail.summary;
            }
          }
        }
      }
    }

    return { ...base, seasons: seasonsWithData };
  }

  // Non-IMDb ID — use TMDB or Wikidata fallback
  const resolved = await Promise.race([
    resolveImdbTitle(imdbId),
    new Promise<null>((r) => setTimeout(() => r(null), 7000)),
  ]).catch(() => null);

  const seasonsCount = resolved?.seasonsCount || base.seasonsCount || 1;
  const totalEpisodes = resolved?.episodesCount || seasonsCount * 12;
  const perSeason = Math.max(1, Math.floor(totalEpisodes / seasonsCount));
  const remainder = totalEpisodes - perSeason * seasonsCount;

  // Prefer real TMDB episode data (with air dates) when the show has a TMDB id.
  const tmdbSeasons = base.tmdbId ? await fetchTmdbSeasonsByTmdbId(base.tmdbId) : null;
  const seasons: Season[] = tmdbSeasons?.length
    ? tmdbSeasons
    : [];

  if (seasons.length === 0) {
    for (let s = 1; s <= seasonsCount; s++) {
      const epCount = s === seasonsCount ? perSeason + remainder : perSeason;
      seasons.push({
        seasonNumber: s,
        episodeCount: epCount,
        episodes: Array.from({ length: epCount }, (_, i) => ({
          seasonNumber: s,
          episodeNumber: i + 1,
          title: `Episode ${i + 1}`,
          overview: `Season ${s} Episode ${i + 1} of ${base.title}`,
        })),
      });
    }
  }

  return { ...base, seasons };
}
