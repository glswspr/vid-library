import { memo, useEffect, useState } from 'react';
import type { FC, MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import type { MediaItem } from '../types';
import { isInWatchlist, toggleWatchlist } from '../utils/storage';
import { Bookmark, BookmarkCheck, Play, Star } from 'lucide-react';

interface MediaCardProps {
  item: MediaItem;
}

export const MediaCard: FC<MediaCardProps> = ({ item }) => {
  const [inList, setInList] = useState<boolean>(() => isInWatchlist(item.id));

  useEffect(() => {
    const sync = () => setInList(isInWatchlist(item.id));
    window.addEventListener('watchlist-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('watchlist-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, [item.id]);

  const targetUrl = item.type === 'movie'
    ? `/movie/${item.id}`
    : `/tv/${item.id}/season/1/episode/1`;

  const handleToggleList = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWatchlist({
      id: item.id,
      title: item.title,
      type: item.type,
      posterUrl: item.posterUrl,
      year: item.year,
      rating: item.rating,
    });
  };

  return (
    <Link
      to={targetUrl}
      className="group relative bg-slate-800/40 rounded-xl overflow-hidden border border-slate-700/50 hover:border-cyan-500/60 group-focus-visible:border-cyan-500/80 transition-all duration-300 flex flex-col hover:-translate-y-1 group-focus-visible:-translate-y-1 hover:shadow-[0_8px_30px_rgba(6,182,212,0.25)] group-focus-visible:shadow-[0_8px_30px_rgba(6,182,212,0.25)]"
    >
      <div className="aspect-[2/3] w-full relative bg-slate-800 overflow-hidden">
        {item.posterUrl ? (
          <img
            src={item.posterUrl}
            alt={item.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-600 font-medium text-sm p-4 text-center">
            No Poster Available
          </div>
        )}

        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center transform scale-75 group-hover:scale-100 group-focus-visible:scale-100 transition-transform duration-300 shadow-lg shadow-cyan-500/50">
            <Play className="w-6 h-6 fill-current translate-x-0.5" />
          </div>
        </div>

        <div className="absolute top-2.5 left-2.5">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
            item.type === 'movie' ? 'bg-cyan-500 text-slate-950' : 'bg-indigo-500 text-white'
          }`}>
            {item.type}
          </span>
        </div>

        {item.rating && (
          <div className="absolute top-2.5 right-2.5 bg-slate-900/80 backdrop-blur px-2 py-0.5 rounded text-xs font-semibold text-amber-400 flex items-center gap-1">
            <Star className="w-3 h-3 fill-current" />
            <span>{item.rating}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleToggleList}
          aria-pressed={inList}
          aria-label={inList ? `Remove ${item.title} from My List` : `Add ${item.title} to My List`}
          title={inList ? 'Remove from My List' : 'Add to My List'}
          className={`
            absolute bottom-2.5 right-2.5 z-10
            flex items-center justify-center
            w-8 h-8 rounded-full border backdrop-blur-md
            shadow-lg shadow-black/40 transition-all duration-200 cursor-pointer
            ${inList
              ? 'bg-cyan-500 border-cyan-400 text-slate-950 opacity-100'
              : 'bg-black/70 border-white/30 text-white hover:bg-black hover:border-cyan-400 hover:text-cyan-300 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
            }
          `}
        >
          {inList ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
        </button>
      </div>

      <div className="p-3 flex flex-col justify-between flex-1">
        <div>
          <h3 className="font-semibold text-slate-200 text-sm line-clamp-1 group-hover:text-cyan-400 group-focus-visible:text-cyan-400 transition-colors">
            {item.title}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5 flex items-center justify-between">
            <span>{item.year || 'N/A'}</span>
            {item.genre && <span className="line-clamp-1 text-[11px] text-slate-500">{item.genre.split(',')[0]}</span>}
          </p>
        </div>
      </div>
    </Link>
  );
};

export default memo(MediaCard);
