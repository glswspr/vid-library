import { useRef, type ReactNode } from 'react';
import type { FC } from 'react';
import type { MediaItem } from '../types';
import { MediaCard } from './MediaCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MediaRowProps {
  title: string;
  items: MediaItem[];
  /** Optional leading icon rendered next to the title. */
  icon?: ReactNode;
  /** Message shown when the row has no items. */
  emptyMessage?: string;
}

/**
 * A horizontal, D-pad-friendly recommendation carousel (the same "row" idea
 * as v2d / VidLibrary Lite). On desktop, arrow buttons scroll the row; on TV
 * the global spatial-nav hook scrolls it via `scrollIntoView({inline:'nearest'})`
 * and the scrollbar is hidden. Reuses MediaCard for consistent visuals.
 */
export const MediaRow: FC<MediaRowProps> = ({ title, items, icon, emptyMessage }) => {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollDir = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <h2 className="text-xl font-bold text-white tracking-tight truncate">{title}</h2>
        </div>

        {/* Desktop scroll arrows — hidden on TV where the D-pad handles it. */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => scrollDir(-1)}
            aria-label={`Scroll ${title} left`}
            className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:border-cyan-500 hover:text-cyan-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollDir(1)}
            aria-label={`Scroll ${title} right`}
            className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:border-cyan-500 hover:text-cyan-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-6 text-center text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800/50">
          <p className="text-sm">{emptyMessage ?? 'Nothing here yet.'}</p>
        </div>
      ) : (
        <div
          ref={scrollerRef}
          className="flex gap-4 overflow-x-auto pb-2 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item) => (
            <div key={item.id} className="w-36 sm:w-40 md:w-44 lg:w-48 shrink-0">
              <MediaCard item={item} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
