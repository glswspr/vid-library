import type { FC } from 'react';
import { Link } from 'react-router-dom';
import type { MediaItem } from '../types';
import { Play, Star } from 'lucide-react';

interface MediaCardProps {
  item: MediaItem;
}

export const MediaCard: FC<MediaCardProps> = ({ item }) => {
  const targetUrl = item.type === 'movie' 
    ? `/movie/${item.id}`
    : `/tv/${item.id}/season/1/episode/1`;

  return (
    <Link
      to={targetUrl}
      className="group relative bg-slate-800/40 rounded-xl overflow-hidden border border-slate-700/50 hover:border-cyan-500/50 group-focus-visible:border-cyan-500/80 transition-all duration-300 flex flex-col hover:-translate-y-1 group-focus-visible:-translate-y-1 hover:shadow-xl hover:shadow-cyan-950/30"
    >
      {/* Poster Container */}
      <div className="aspect-[2/3] w-full relative bg-slate-900 overflow-hidden">
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

        {/* Hover / Focus Overlay — revealed by hover (desktop) or focus (TV) */}
        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center transform scale-75 group-hover:scale-100 group-focus-visible:scale-100 transition-transform duration-300 shadow-lg shadow-cyan-500/50">
            <Play className="w-6 h-6 fill-current translate-x-0.5" />
          </div>
        </div>

        {/* Media Type Badge */}
        <div className="absolute top-2.5 left-2.5">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
            item.type === 'movie' ? 'bg-cyan-500 text-slate-950' : 'bg-indigo-500 text-white'
          }`}>
            {item.type}
          </span>
        </div>

        {/* Rating Badge */}
        {item.rating && (
          <div className="absolute top-2.5 right-2.5 bg-slate-900/80 backdrop-blur px-2 py-0.5 rounded text-xs font-semibold text-amber-400 flex items-center gap-1">
            <Star className="w-3 h-3 fill-current" />
            <span>{item.rating}</span>
          </div>
        )}
      </div>

      {/* Info Container */}
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
