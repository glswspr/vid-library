import { useEffect, useRef, useState } from 'react';
import type { FC } from 'react';
import type { MediaItem } from '../types';
import { fetchTrendingMovies, fetchTrendingTVShows } from '../services/catalog';
import { MediaCard } from './MediaCard';
import { Skeleton } from './Skeleton';
import { Film, Tv, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Home-screen recommendations — "Trending Movies" and "Trending TV Shows"
 * displayed side-by-side in a single row (each occupying half the width on
 * desktop, stacked on mobile). Rows that come back empty are hidden; if both
 * are empty the section disappears entirely so the landing page stays clean.
 */
export const Trending: FC = () => {
  const [movies, setMovies] = useState<MediaItem[] | null>(null);
  const [shows, setShows] = useState<MediaItem[] | null>(null);
  const movieScrollerRef = useRef<HTMLDivElement>(null);
  const showScrollerRef = useRef<HTMLDivElement>(null);

  const scrollDir = (dir: 1 | -1, ref: HTMLDivElement | null) => {
    if (!ref) return;
    ref.scrollBy({ left: dir * ref.clientWidth * 0.8, behavior: 'smooth' });
  };

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

  const loading = movies === null || shows === null;

  if (loading) {
    return (
      <section className="mb-12" aria-busy="true" aria-label="Trending recommendations loading">
        <div className="flex items-center gap-2 mb-4">
          <Film className="w-6 h-6 text-cyan-400" />
          <h2 className="text-xl font-bold text-white tracking-tight">Trending</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, col) => (
            <div key={col} className="flex gap-4 overflow-hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="w-[calc((100%-2rem)/3)] shrink-0">
                  <Skeleton className="aspect-[2/3] w-full" />
                  <Skeleton className="h-4 w-3/4 mt-3" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    );
  }

  const movieRow = movies.length > 0;
  const showRow = shows.length > 0;

  if (!movieRow && !showRow) return null;

  return (
    <section className="mb-12">
      <div className="flex items-center gap-2 mb-4">
        <Film className="w-6 h-6 text-cyan-400" />
        <h2 className="text-xl font-bold text-white tracking-tight">Trending</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {movieRow && (
          <div>
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex items-center gap-2">
                <Film className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Trending Movies</h3>
              </div>
              <div className="hidden sm:flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => scrollDir(-1, movieScrollerRef.current)}
                  aria-label="Scroll Trending Movies left"
                  className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:border-cyan-500 hover:text-cyan-300 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollDir(1, movieScrollerRef.current)}
                  aria-label="Scroll Trending Movies right"
                  className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:border-cyan-500 hover:text-cyan-300 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div
              ref={movieScrollerRef}
              className="flex gap-4 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {movies.map((item) => (
                <div key={item.id} className="w-[calc((100%-2rem)/3)] shrink-0 snap-start">
                  <MediaCard item={item} />
                </div>
              ))}
            </div>
          </div>
        )}
        {showRow && (
          <div>
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex items-center gap-2">
                <Tv className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Trending TV Shows</h3>
              </div>
              <div className="hidden sm:flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => scrollDir(-1, showScrollerRef.current)}
                  aria-label="Scroll Trending TV Shows left"
                  className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:border-cyan-500 hover:text-cyan-300 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollDir(1, showScrollerRef.current)}
                  aria-label="Scroll Trending TV Shows right"
                  className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:border-cyan-500 hover:text-cyan-300 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div
              ref={showScrollerRef}
              className="flex gap-4 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {shows.map((item) => (
                <div key={item.id} className="w-[calc((100%-2rem)/3)] shrink-0 snap-start">
                  <MediaCard item={item} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
