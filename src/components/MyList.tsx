import { useEffect, useState, useCallback } from 'react';
import type { FC } from 'react';
import type { WatchlistItem } from '../types';
import { getWatchlist, updateWatchlistPoster, updateWatchlistRating } from '../utils/storage';
import { getPosterUrl, getRatingUrl } from '../utils/posters';
import { Bookmark } from 'lucide-react';
import { MediaCard } from './MediaCard';

/**
 * "My List" — titles the user bookmarked. Shown only when non-empty so the
 * landing page stays clean. Renders the same MediaCard grid as the rest of
 * the app (keyboard/TV-navigable links).
 */
export const MyList: FC = () => {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const refresh = useCallback(() => {
    setItems(getWatchlist());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const backfill = async () => {
      const list = getWatchlist();
      await Promise.all(
        list.map(async (item) => {
          if (!item.posterUrl) {
            const url = await getPosterUrl(item.id, item.type);
            if (url) updateWatchlistPoster(item.id, url);
          }
          if (!item.rating) {
            const rating = await getRatingUrl(item.id, item.type);
            if (rating) updateWatchlistRating(item.id, rating);
          }
        }),
      );
      if (!cancelled) refresh();
    };

    const timer = setTimeout(() => {
      backfill().finally(() => {
        if (!cancelled) setLoading(false);
      });
    }, 300);

    window.addEventListener('storage', refresh);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener('storage', refresh);
    };
  }, [refresh]);

  if (loading) {
    return (
      <section className="mb-12" aria-busy="true" aria-label="My List loading">
        <div className="flex items-center gap-2 mb-4">
          <Bookmark className="w-6 h-6 text-cyan-400" />
          <h2 className="text-xl font-bold text-white tracking-tight">My List</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-[2/3] w-full bg-slate-800/60 rounded-xl animate-pulse mb-2" />
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
      <div className="flex items-center gap-2 mb-4">
        <Bookmark className="w-6 h-6 text-cyan-400" />
        <h2 className="text-xl font-bold text-white tracking-tight">My List</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
        {items.map((item) => (
          <MediaCard
            key={item.id}
            item={{
              id: item.id,
              title: item.title,
              type: item.type,
              year: item.year,
              posterUrl: item.posterUrl,
              rating: item.rating,
            }}
          />
        ))}
      </div>
    </section>
  );
};
