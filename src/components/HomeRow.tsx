import { useEffect, useRef, useState } from 'react';
import type { FC } from 'react';
import type { MediaItem } from '../types';
import type { HomeRowDef } from '../services/rows';
import { loadRow } from '../services/rows';
import { MediaRow } from './MediaRow';
import { Skeleton } from './Skeleton';
import { Film, Tv, Sparkles } from 'lucide-react';

interface HomeRowProps {
  def: HomeRowDef;
  getExcludeIds: () => Set<string>;
  onLoaded: (rowId: string, ids: string[]) => void;
}

type RowState = 'idle' | 'loading' | 'done' | 'empty';

const rowIcon = (icon: HomeRowDef['icon']) => {
  const className = 'w-5 h-5 text-cyan-400';
  if (icon === 'tv') return <Tv className={className} />;
  if (icon === 'sparkles') return <Sparkles className={className} />;
  return <Film className={className} />;
};

/**
 * One home-page row. Fetches lazily when scrolled near the viewport, shows a
 * skeleton while loading, and collapses entirely when it ends up empty.
 */
export const HomeRow: FC<HomeRowProps> = ({ def, getExcludeIds, onLoaded }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const [state, setState] = useState<RowState>('idle');
  const [items, setItems] = useState<MediaItem[]>([]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (startedRef.current || !entries.some((e) => e.isIntersecting)) return;
        startedRef.current = true;
        observer.disconnect();
        setState('loading');

        loadRow(def).then((result) => {
          // Re-read the exclusion set after the fetch: rows load in parallel,
          // so a snapshot taken before it still misses ids claimed by a row
          // that finished first (the same title would appear in two rows).
          const claimed = getExcludeIds();
          const filtered = result.filter((it) => !claimed.has(it.id));
          if (filtered.length === 0) {
            setState('empty');
            return;
          }
          onLoaded(def.id, filtered.map((it) => it.id));
          setItems(filtered);
          setState('done');
        });
      },
      // Start fetching before the row scrolls into view.
      { rootMargin: '600px 0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [def, getExcludeIds, onLoaded]);

  return (
    <div ref={containerRef}>
      {state === 'done' && (
        <MediaRow title={def.title} items={items} icon={rowIcon(def.icon)} />
      )}
      {(state === 'idle' || state === 'loading') && (
        <section className="mb-12" aria-busy="true" aria-label={`${def.title} loading`}>
          <Skeleton className="w-56 h-7 mb-4" />
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-36 sm:w-40 md:w-44 lg:w-48 shrink-0">
                <Skeleton className="aspect-[2/3] w-full" />
                <Skeleton className="h-4 w-3/4 mt-3" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
