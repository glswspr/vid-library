import { fetchTmdbTVEpisodes, fetchTmdbSeasonsByTmdbId } from './embed2';
import { getAllWatchProgress } from '../utils/storage';
import type { WatchProgress, Episode, Season } from '../types';
import { WATCHED_THRESHOLD } from '../constants';

export interface NewEpisodeInfo {
  showId: string;
  showTitle: string;
  posterUrl?: string;
  newEpisodes: Episode[];
}

/**
 * Progress entries can hold either an IMDb id (from search) or a numeric TMDB
 * id (from the home rows), so resolve the matching episode source.
 */
async function getLatestEpisodesForShow(id: string): Promise<Season[] | null> {
  return /^\d+$/.test(id) ? fetchTmdbSeasonsByTmdbId(id) : fetchTmdbTVEpisodes(id);
}

/** Most recently watched episode of a show, by season then episode. */
function getLatestWatchedEpisode(progress: WatchProgress[]): WatchProgress | null {
  const episodes = progress.filter(
    (p) => p.seasonNumber != null && p.episodeNumber != null,
  );
  if (episodes.length === 0) return null;

  let latest = episodes[0];
  for (const p of episodes) {
    if (
      p.seasonNumber! > latest.seasonNumber! ||
      (p.seasonNumber! === latest.seasonNumber! && p.episodeNumber! > latest.episodeNumber!)
    ) {
      latest = p;
    }
  }
  return latest;
}

function isFinished(progress: WatchProgress): boolean {
  return !!progress.completed ||
    (progress.duration > 0 && progress.progress / progress.duration >= WATCHED_THRESHOLD);
}

/**
 * Episodes after `lastWatched` that have already aired. Future episodes are
 * excluded so the row never advertises an episode that cannot be played yet.
 */
function findNewEpisodes(
  seasons: Season[],
  lastWatched: { season: number; episode: number },
): Episode[] {
  const today = new Date().toISOString().slice(0, 10);
  const newEpisodes: Episode[] = [];
  for (const season of seasons) {
    if (season.seasonNumber < lastWatched.season) continue;
    for (const ep of season.episodes) {
      if (season.seasonNumber === lastWatched.season && ep.episodeNumber <= lastWatched.episode) continue;
      if (ep.airDate && ep.airDate > today) continue;
      newEpisodes.push(ep);
    }
  }
  return newEpisodes;
}

export async function checkForNewEpisodes(): Promise<NewEpisodeInfo[]> {
  const allProgress = getAllWatchProgress();
  const tvShowIds = new Set<string>();

  for (const p of allProgress) {
    if (p.type === 'tv' && p.seasonNumber != null && p.episodeNumber != null) {
      tvShowIds.add(p.id);
    }
  }

  const results = await Promise.all(
    Array.from(tvShowIds).map(async (showId): Promise<NewEpisodeInfo | null> => {
      const showProgress = allProgress.filter((p) => p.id === showId && p.type === 'tv');
      const latest = getLatestWatchedEpisode(showProgress);
      // Only shows the user has caught up on advertise new episodes; a
      // half-watched show already appears in Continue Watching.
      if (!latest || !latest.seasonNumber || !latest.episodeNumber || !isFinished(latest)) return null;

      const seasons = await getLatestEpisodesForShow(showId);
      if (!seasons || seasons.length === 0) return null;

      const newEpisodes = findNewEpisodes(seasons, {
        season: latest.seasonNumber,
        episode: latest.episodeNumber,
      });
      if (newEpisodes.length === 0) return null;

      return {
        showId,
        showTitle: latest.title || showId,
        posterUrl: latest.posterUrl,
        newEpisodes,
      };
    }),
  );

  return results.filter((item): item is NewEpisodeInfo => item !== null);
}
