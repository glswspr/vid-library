import { useEffect, useState } from 'react';
import type { FC } from 'react';
import type { MediaItem } from '../types';
import { fetchSimilarMovies, fetchSimilarTVShows } from '../services/catalog';
import { MediaRow } from './MediaRow';
import { Skeleton } from './Skeleton';
import { Sparkles } from 'lucide-react';

interface MoreLikeThisProps {
  media: MediaItem;
}

/**
 * "More Like This" recommendations on detail pages — the similar-titles row
 * from v2d (VidLibrary Lite), ported to the main app. Uses the 2embed
 * similar endpoint via the IMDb id; hidden entirely when nothing is returned.
 */
export const MoreLikeThis: FC<MoreLikeThisProps> = ({ media }) => {
  const [items, setItems] = useState<MediaItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    const load = async () => {
      // Prefer the IMDb id (what the 2embed similar endpoint expects).
      const id = media.imdbId || (media.id.startsWith('tt') ? media.id : media.tmdbId || media.id);
      const list =
        media.type === 'movie'
          ? await fetchSimilarMovies(id).catch(() => [] as MediaItem[])
          : await fetchSimilarTVShows(id).catch(() => [] as MediaItem[]);
      if (!cancelled) setItems(list);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [media.id, media.imdbId, media.tmdbId, media.type]);

  if (items === null) {
    return (
      <section className="mb-12" aria-busy="true" aria-label="More Like This loading">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-6 h-6 text-cyan-400" />
          <h2 className="text-xl font-bold text-white tracking-tight">More Like This</h2>
        </div>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-36 sm:w-40 md:w-44 lg:w-48 shrink-0">
              <Skeleton className="aspect-[2/3] w-full" />
              <Skeleton className="h-4 w-3/4 mt-3" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <MediaRow
      title="More Like This"
      items={items}
      icon={<Sparkles className="w-6 h-6 text-cyan-400 shrink-0" />}
    />
  );
};
