import { useEffect, useRef, useState } from 'react';
import type { FC } from 'react';
import { Link } from 'react-router-dom';
import type { WatchProgress, TVShowDetails, Episode } from '../types';
import { getAllWatchProgress, updateProgressPoster, updateProgressRating, updateProgressGenreForShow, removeShowWatchProgress, updateProgressTitle } from '../utils/storage';
import { getPosterUrl, getRatingUrl, getGenre, getTitle } from '../utils/posters';
import { getTVShowDetails } from '../services/catalog';
import { Play, Clock, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface ContinueWatchingItem extends WatchProgress {
  nextEpisode?: Episode | null;
  showDetails?: TVShowDetails | null;
}

const NEXT_EPISODE_THRESHOLD = 0.95;

/**
 * For TV items that are nearly complete (>= 95% watched), fetch the show's
 * episode list and resolve the next episode after the current one. The
 * returned list includes those enriched items so the UI can offer a
 * "Next episode" card. If details can't be loaded, the item is returned
 * unchanged.
 */
async function enrichWithNextEpisodes(
  items: WatchProgress[],
): Promise<ContinueWatchingItem[]> {
  const tvItems = items.filter(
    (item) =>
      item.type === 'tv' &&
      item.seasonNumber != null &&
      item.episodeNumber != null &&
      item.duration > 0 &&
      item.progress / item.duration >= NEXT_EPISODE_THRESHOLD,
  );

  if (tvItems.length === 0) {
    return items;
  }

  const showIdSet = new Set<string>();
  for (const item of tvItems) showIdSet.add(item.id);

  const detailsMap = new Map<string, TVShowDetails>();
  await Promise.all(
    Array.from(showIdSet).map(async (id) => {
      try {
        const details = await getTVShowDetails(id);
        detailsMap.set(id, details);
      } catch {
        // Leave out of map; the item will render without a next-episode link.
      }
    }),
  );

  const result: ContinueWatchingItem[] = [];
  for (const item of items) {
    if (
      item.type === 'tv' &&
      item.seasonNumber != null &&
      item.episodeNumber != null &&
      item.duration > 0 &&
      item.progress / item.duration >= NEXT_EPISODE_THRESHOLD
    ) {
      const showDetails = detailsMap.get(item.id) || null;
      let nextEpisode: Episode | null = null;
      if (showDetails) {
        nextEpisode = findNextEpisode(
          showDetails,
          item.seasonNumber,
          item.episodeNumber,
        );
      }
      result.push({ ...item, showDetails, nextEpisode });
    } else {
      result.push(item);
    }
  }
  return result;
}

/**
 * Given a show's seasons and the current season/episode, find the next
 * episode in air order. Returns null if there is no next episode (i.e. the
 * user is up to date on the latest episode).
 */
function findNextEpisode(
  show: TVShowDetails,
  season: number,
  episode: number,
): Episode | null {
  // Flatten all episodes across seasons into a single ordered list so we can
  // walk forward from the current position. Season arrays are assumed sorted
  // by season number; episodes within a season by episode number.
  const all: Episode[] = [];
  for (const s of show.seasons) {
    all.push(...s.episodes);
  }
  if (all.length === 0) return null;

  const idx = all.findIndex(
    (ep) => ep.seasonNumber === season && ep.episodeNumber === episode,
  );
  if (idx === -1) return null;
  return all[idx + 1] ?? null;
}

export const ContinueWatching: FC = () => {
  const [items, setItems] = useState<ContinueWatchingItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollDir = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  useEffect(() => {
    let cancelled = false;

    const latestByShow = new Map<string, WatchProgress>();

    const computeLatest = () => {
      latestByShow.clear();
      const all = getAllWatchProgress();
      for (const item of all) {
        if (item.type !== 'tv' || item.seasonNumber == null || item.episodeNumber == null) {
          latestByShow.set(item.id, item);
          continue;
        }
        const existing = latestByShow.get(item.id);
        if (!existing || item.updatedAt > existing.updatedAt) {
          latestByShow.set(item.id, item);
        }
      }
    };

    const load = () => {
      computeLatest();
      if (!cancelled) setItems([...latestByShow.values()]);
    };

    const backfill = async () => {
      const list = getAllWatchProgress();
      await Promise.all(
        list.map(async (item) => {
          if (!item.posterUrl) {
            const url = await getPosterUrl(item.id, item.type);
            if (url) {
              updateProgressPoster(item.id, url, item.seasonNumber, item.episodeNumber);
            }
          }
          if (!item.rating) {
            const rating = await getRatingUrl(item.id, item.type);
            if (rating) {
              updateProgressRating(item.id, rating, item.seasonNumber, item.episodeNumber);
            }
          }
          if (!item.genre) {
            const genre = await getGenre(item.id, item.type);
            if (genre) updateProgressGenreForShow(item.id, genre);
          }
          if (!item.title || item.title === item.id) {
            const title = await getTitle(item.id, item.type);
            if (title) updateProgressTitle(item.id, title);
          }
        }),
      );
      // Let dependent views (e.g. watch stats) know stored entries changed.
      window.dispatchEvent(new Event('watch-progress-updated'));
      if (!cancelled) {
        computeLatest();
        // Enrich TV items that are nearly complete (>= 95%) with next-episode info.
        const enriched = await enrichWithNextEpisodes([...latestByShow.values()]);
        if (!cancelled) setItems(enriched);
      }
    };

    load();
    const timer = setTimeout(() => {
      backfill().finally(() => {
        if (!cancelled) setLoading(false);
      });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  if (loading) {
    return (
      <section className="mb-12" aria-busy="true" aria-label="Continue Watching loading">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-6 h-6 text-cyan-400" />
          <h2 className="text-xl font-bold text-white tracking-tight">Continue Watching</h2>
        </div>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-36 sm:w-40 md:w-44 lg:w-48 shrink-0">
              <div className="aspect-video w-full bg-slate-800/60 rounded-xl animate-pulse mb-2" />
              <div className="h-3 w-3/4 bg-slate-800/60 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <Clock className="w-6 h-6 text-cyan-400" />
          <h2 className="text-xl font-bold text-white tracking-tight truncate">Continue Watching</h2>
        </div>
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => scrollDir(-1)}
            aria-label="Scroll Continue Watching left"
            className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:border-cyan-500 hover:text-cyan-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollDir(1)}
            aria-label="Scroll Continue Watching right"
            className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:border-cyan-500 hover:text-cyan-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="relative">
        <div
          ref={scrollerRef}
          className="flex gap-4 overflow-x-auto pb-2 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 scroll-smooth snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.flatMap((item) => {
            const targetUrl = item.type === 'movie'
              ? `/movie/${item.id}`
              : `/tv/${item.id}/season/${item.seasonNumber || 1}/episode/${item.episodeNumber || 1}`;

            const percent = item.duration > 0
              ? Math.min(100, Math.round((item.progress / item.duration) * 100))
              : 0;

            const handleRemove = (e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              // Clear the whole title, not just this episode: the row is
              // deduplicated to one card per show, so leaving sibling episodes
              // behind would resurface the show on the next load.
              removeShowWatchProgress(item.id);
              setItems((prev) => prev.filter((i) => i.id !== item.id));
            };

            const cards: React.ReactNode[] = [];

            const showNextEpisodeCard =
              item.type === 'tv' &&
              item.nextEpisode &&
              percent >= 95;

            if (!showNextEpisodeCard) {
              cards.push(
                <div key={`cw_${item.id}_${item.seasonNumber}_${item.episodeNumber}`} className="group relative w-36 sm:w-40 md:w-44 lg:w-48 shrink-0 snap-start">
                  <Link
                    to={targetUrl}
                    className="relative bg-slate-800/40 rounded-xl overflow-hidden border-2 border-slate-700/50 hover:border-cyan-500/50 transition-all flex flex-col"
                  >
                    <div className="aspect-video w-full bg-slate-900 relative overflow-hidden">
                      {item.posterUrl ? (
                        <img
                          src={item.posterUrl}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600 text-sm p-2 text-center">
                          {item.title}
                        </div>
                      )}

                      <div className="absolute inset-0 bg-slate-950/30 flex items-center justify-center pointer-events-none">
                        <div className="w-12 h-12 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                          <Play className="w-6 h-6 fill-current translate-x-0.5" />
                        </div>
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-800">
                        <div
                          className="h-full bg-cyan-400"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    <div className="p-3">
                      <h3 className="text-sm font-semibold text-slate-200 line-clamp-1">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {item.type === 'tv' ? `S${item.seasonNumber || 1} E${item.episodeNumber || 1}` : 'Movie'}
                        {item.rating ? ` • ${item.rating}★` : ''}
                        {' • '}{percent}% watched
                      </p>
                    </div>
                  </Link>

                  {/* Sibling of the link: a button inside an anchor is invalid
                      HTML and makes click-through handling unreliable. */}
                  <div className="absolute inset-x-0 top-0 aspect-video pointer-events-none">
                    <button
                      type="button"
                      onClick={handleRemove}
                      aria-label={`Remove ${item.title} from Continue Watching`}
                      className="
                        pointer-events-auto
                        absolute top-1.5 right-1.5 z-20
                        flex items-center justify-center
                        w-7 h-7 rounded-lg
                        bg-black/70 border border-white/30
                        text-white
                        opacity-0 group-hover:opacity-100
                        hover:bg-rose-500 hover:border-rose-400 hover:text-white hover:scale-110
                        backdrop-blur-md
                        transition-all duration-200 cursor-pointer
                        shadow-lg shadow-black/40
                      "
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>,
              );
            }

            // For TV items that are nearly complete and have a resolved next
            // episode, show a "Next episode" card in place of the finished one.
            if (showNextEpisodeCard && item.nextEpisode) {
              const nextEp = item.nextEpisode;
              const nextUrl = `/tv/${item.id}/season/${nextEp.seasonNumber}/episode/${nextEp.episodeNumber}`;
              cards.push(
                <div key={`cw_next_${item.id}_${nextEp.seasonNumber}_${nextEp.episodeNumber}`} className="group relative w-36 sm:w-40 md:w-44 lg:w-48 shrink-0 snap-start">
                  <Link
                    to={nextUrl}
                    className="relative bg-slate-800/40 rounded-xl overflow-hidden border-2 border-cyan-500/50 hover:border-cyan-400 transition-all flex flex-col"
                  >
                    <div className="aspect-video w-full bg-slate-900 relative overflow-hidden flex items-center justify-center">
                      {item.posterUrl ? (
                        <img
                          src={item.posterUrl}
                          alt={item.title}
                          className="w-full h-full object-cover opacity-60"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600 text-sm p-2 text-center">
                          {item.title}
                        </div>
                      )}

                      <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center pointer-events-none">
                        <div className="w-12 h-12 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                          <Play className="w-6 h-6 fill-current translate-x-0.5" />
                        </div>
                      </div>

                      <div className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-cyan-500/20 border border-cyan-500/40 rounded text-[9px] font-semibold text-cyan-300 uppercase tracking-wider">
                        Next
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-800">
                        <div className="h-full bg-cyan-400 w-full" />
                      </div>
                    </div>

                    <div className="p-3">
                      <h3 className="text-sm font-semibold text-slate-200 line-clamp-1">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        S{nextEp.seasonNumber} E{nextEp.episodeNumber}
                        {nextEp.title ? ` • ${nextEp.title}` : ''}
                      </p>
                    </div>
                  </Link>

                  <div className="absolute inset-x-0 top-0 aspect-video pointer-events-none">
                    <button
                      type="button"
                      onClick={handleRemove}
                      aria-label={`Remove ${item.title} from Continue Watching`}
                      className="
                        pointer-events-auto
                        absolute top-1.5 right-1.5 z-20
                        flex items-center justify-center
                        w-7 h-7 rounded-lg
                        bg-black/70 border border-white/30
                        text-white
                        opacity-0 group-hover:opacity-100
                        hover:bg-rose-500 hover:border-rose-400 hover:text-white hover:scale-110
                        backdrop-blur-md
                        transition-all duration-200 cursor-pointer
                        shadow-lg shadow-black/40
                      "
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>,
              );
            }

            return cards;
          })}
        </div>
      </div>
    </section>
  );
};
