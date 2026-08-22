import { useEffect, useRef, useState } from 'react';
import type { FC } from 'react';
import { Link } from 'react-router-dom';
import type { WatchProgress } from '../types';
import { getAllWatchProgress, updateProgressPoster, updateProgressRating, removeWatchProgress } from '../utils/storage';
import { getPosterUrl, getRatingUrl } from '../utils/posters';
import { Play, Clock, ChevronLeft, ChevronRight, X } from 'lucide-react';

export const ContinueWatching: FC = () => {
  const [items, setItems] = useState<WatchProgress[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollDir = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  useEffect(() => {
    let cancelled = false;
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
        }),
      );
      if (!cancelled) load();
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
          {items.map((item) => {
            const targetUrl = item.type === 'movie'
              ? `/movie/${item.id}`
              : `/tv/${item.id}/season/${item.seasonNumber || 1}/episode/${item.episodeNumber || 1}`;

            const percent = item.duration > 0
              ? Math.min(100, Math.round((item.progress / item.duration) * 100))
              : 0;

            const handleRemove = (e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              removeWatchProgress(item.id, item.seasonNumber, item.episodeNumber);
              setItems((prev) => prev.filter((i) => !(
                i.id === item.id &&
                i.seasonNumber === item.seasonNumber &&
                i.episodeNumber === item.episodeNumber
              )));
            };

            return (
              <div key={`${item.id}_${item.seasonNumber}_${item.episodeNumber}`} className="w-36 sm:w-40 md:w-44 lg:w-48 shrink-0 snap-start">
                <Link
                  to={targetUrl}
                  className="group relative bg-slate-800/40 rounded-xl overflow-hidden border-2 border-slate-700/50 hover:border-cyan-500/50 transition-all flex flex-col"
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

                    <button
                      type="button"
                      onClick={handleRemove}
                      aria-label={`Remove ${item.title} from Continue Watching`}
                      className="
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
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
