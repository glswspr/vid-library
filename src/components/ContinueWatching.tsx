import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { Link } from 'react-router-dom';
import type { WatchProgress } from '../types';
import { getAllWatchProgress, updateProgressPoster, updateProgressRating } from '../utils/storage';
import { getPosterUrl, getRatingUrl } from '../utils/posters';
import { Play, Clock } from 'lucide-react';

export const ContinueWatching: FC = () => {
  const [items, setItems] = useState<WatchProgress[]>([]);

  useEffect(() => {
    // For TV shows, only keep the most recently watched episode per series.
    const load = () => {
      const list = getAllWatchProgress();
      const latestByShow = new Map<string, WatchProgress>();
      for (const item of list) {
        if (item.type !== 'tv' || item.seasonNumber == null || item.episodeNumber == null) {
          latestByShow.set(item.id, item);
          continue;
        }
        const existing = latestByShow.get(item.id);
        if (!existing || item.updatedAt > existing.updatedAt) {
          latestByShow.set(item.id, item);
        }
      }
      setItems([...latestByShow.values()]);
    };
    load();
    load();
    // Backfill posters for items saved while the 2embed API was unreachable
    // (CORS) — resolve via TMDB and persist so the fix is permanent.
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
        }),
      );
      load();
    };
    backfill();
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="mb-12">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-6 h-6 text-cyan-400" />
        <h2 className="text-xl font-bold text-white tracking-tight">Continue Watching</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
        {items.map((item) => {
          const targetUrl = item.type === 'movie'
            ? `/movie/${item.id}`
            : `/tv/${item.id}/season/${item.seasonNumber || 1}/episode/${item.episodeNumber || 1}`;

          const percent = item.duration > 0
            ? Math.min(100, Math.round((item.progress / item.duration) * 100))
            : 0;

          return (
            <Link
              key={`${item.id}_${item.seasonNumber}_${item.episodeNumber}`}
              to={targetUrl}
              className="group relative bg-slate-800/40 rounded-xl overflow-hidden border-2 border-slate-700/50 hover:border-cyan-500/50 transition-all"
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
                
                <div className="absolute inset-0 bg-slate-950/30 flex items-center justify-center">
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
          );
        })}
      </div>
    </section>
  );
};
