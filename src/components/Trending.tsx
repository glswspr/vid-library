import { useEffect, useState } from 'react';
import type { FC } from 'react';
import type { MediaItem } from '../types';
import { fetchTrendingMovies, fetchTrendingTVShows } from '../services/catalog';
import { MediaRow } from './MediaRow';
import { Skeleton } from './Skeleton';
import { Film, Tv } from 'lucide-react';

/**
 * Home-screen recommendations — the "Trending Movies" / "Trending TV Shows"
 * carousel rows from v2d (VidLibrary Lite), ported to the main app.
 * Rows that come back empty are hidden; if both are empty the section
 * disappears entirely so the landing page stays clean.
 */
export const Trending: FC = () => {
  const [movies, setMovies] = useState<MediaItem[] | null>(null);
  const [shows, setShows] = useState<MediaItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchTrendingMovies().catch(() => [] as MediaItem[]),
      fetchTrendingTVShows().catch(() => [] as MediaItem[]),
    ]).then(([movieList, showList]) => {
      if (cancelled) return;
      setMovies(movieList);
      setShows(showList);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (movies === null || shows === null) {
    return (
      <section className="mb-12" aria-busy="true" aria-label="Trending recommendations loading">
        <div className="flex items-center gap-2 mb-4">
          <Film className="w-6 h-6 text-cyan-400" />
          <h2 className="text-xl font-bold text-white tracking-tight">Trending</h2>
        </div>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="w-36 sm:w-40 md:w-44 lg:w-48 shrink-0">
              <Skeleton className="aspect-[2/3] w-full" />
              <Skeleton className="h-4 w-3/4 mt-3" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  const movieRow = movies.length > 0 ? (
    <MediaRow
      title="Trending Movies"
      items={movies}
      icon={<Film className="w-6 h-6 text-cyan-400 shrink-0" />}
    />
  ) : null;

  const showRow = shows.length > 0 ? (
    <MediaRow
      title="Trending TV Shows"
      items={shows}
      icon={<Tv className="w-6 h-6 text-cyan-400 shrink-0" />}
    />
  ) : null;

  if (!movieRow && !showRow) return null;

  return (
    <>
      {movieRow}
      {showRow}
    </>
  );
};
