import { useCallback } from 'react';
import type { TVShowDetails } from '../types';

interface EpisodeNavResult {
  nextSeason: number | null;
  nextEpisode: number | null;
  prevSeason: number | null;
  prevEpisode: number | null;
  goNext: () => void;
  goPrev: () => void;
}

/**
 * Centralized episode navigation logic for TV show pages.
 * Calculates prev/next episode (wrapping across seasons) and provides
 * navigation callbacks. Used by both keyboard shortcuts and UI buttons.
 */
export function useEpisodeNavigation(
  show: TVShowDetails | null,
  currentSeason: number,
  currentEpisode: number,
  navigate: (path: string) => void,
): EpisodeNavResult {
  const showId = show?.id;
  const seasonCount = show?.seasons.length ?? 0;

  const activeSeasonData = show
    ? show.seasons.find((s) => s.seasonNumber === currentSeason) || show.seasons[0]
    : undefined;
  const episodeCountInActiveSeason = activeSeasonData ? activeSeasonData.episodes.length : 10;

  // Next episode
  let nextSeason: number | null = null;
  let nextEpisode: number | null = null;
  if (show && currentEpisode < episodeCountInActiveSeason) {
    nextSeason = currentSeason;
    nextEpisode = currentEpisode + 1;
  } else if (show && currentSeason < seasonCount) {
    nextSeason = currentSeason + 1;
    nextEpisode = 1;
  }

  // Previous episode
  let prevSeason: number | null = null;
  let prevEpisode: number | null = null;
  if (show && currentEpisode > 1) {
    prevSeason = currentSeason;
    prevEpisode = currentEpisode - 1;
  } else if (show && currentSeason > 1) {
    const prevData = show.seasons.find((s) => s.seasonNumber === currentSeason - 1);
    prevSeason = currentSeason - 1;
    prevEpisode = prevData ? prevData.episodes.length : 10;
  }

  const goNext = useCallback(() => {
    if (showId && nextSeason && nextEpisode) {
      navigate(`/tv/${showId}/season/${nextSeason}/episode/${nextEpisode}`);
    }
  }, [nextSeason, nextEpisode, showId, navigate]);

  const goPrev = useCallback(() => {
    if (showId && prevSeason && prevEpisode) {
      navigate(`/tv/${showId}/season/${prevSeason}/episode/${prevEpisode}`);
    }
  }, [prevSeason, prevEpisode, showId, navigate]);

  return { nextSeason, nextEpisode, prevSeason, prevEpisode, goNext, goPrev };
}
