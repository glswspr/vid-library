// Re-exports the domain modules so existing importers keep working
// unchanged. Each domain concern now lives in its own module:
//   - ./embed2.ts   → 2embed catalog API (trending, details, episodes, similar)
//   - ./search.ts   → title search (TMDB / Wikidata / OMDb)
//   - ./metadata.ts → IMDb → TMDB/Wikidata resolution, poster lookup
//   - ./details.ts  → getMediaDetails / getTVShowDetails composition
//   - ./config.ts   → shared API keys/base URLs

export {
  fetchTrendingMovies,
  fetchTrendingTVShows,
  fetchMovieDetail,
  fetchShowDetail,
  fetchSeasonEpisodes,
  fetchSimilarMovies,
  fetchSimilarTVShows,
} from './embed2';

export { searchByTitle, searchPersonCredits } from './search';
export type { SearchResult } from './search';

export {
  resolveDirectImdbId,
  resolveImdbTitle,
  resolveTmdbFromImdb,
  resolveTmdbId,
  detectMediaType,
  resolvePosterUrl,
  fetchWikipediaEpisodeCounts,
  fetchWikipediaSeasonEpisodeDetails,
  fetchTitle,
} from './metadata';
export type { WikipediaEpisodeDetail } from './metadata';

export { getMediaDetails, getTVShowDetails } from './details';
