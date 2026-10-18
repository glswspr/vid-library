import { useEffect, useRef, useState } from 'react';
import type { FC, ComponentType } from 'react';
import { getAllWatchProgress } from '../utils/storage';
import { computeWatchTime } from '../utils/watchStats';
import { Film, Tv, Clock, Sparkles, BarChart3 } from 'lucide-react';

interface Stats {
  moviesThisMonth: number;
  episodesThisMonth: number;
  totalSeconds: number;
  topGenre: string | null;
}

interface StatRow {
  icon: ComponentType<{ className?: string }>;
  value: string;
  label: string;
}

const startOfMonth = (): number => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
};

const formatWatchTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  if (hours >= 1) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  return `${mins}m`;
};

function computeStats(): Stats | null {
  const items = getAllWatchProgress();
  if (items.length === 0) return null;

  const monthStart = startOfMonth();
  const movieIdsThisMonth = new Set<string>();
  let episodesThisMonth = 0;
  const genreCounts = new Map<string, number>();
  const seenTitles = new Set<string>();

  for (const item of items) {
    if (item.updatedAt >= monthStart) {
      if (item.type === 'movie') {
        movieIdsThisMonth.add(item.id);
      } else {
        episodesThisMonth += 1;
      }
    }

    // Count each title once toward its primary genre.
    if (item.genre && !seenTitles.has(item.id)) {
      seenTitles.add(item.id);
      const primary = item.genre.split(',')[0]?.trim();
      if (primary) genreCounts.set(primary, (genreCounts.get(primary) || 0) + 1);
    }
  }

  let topGenre: string | null = null;
  let topCount = 0;
  for (const [genre, count] of genreCounts) {
    if (count > topCount) {
      topCount = count;
      topGenre = genre;
    }
  }

  return {
    moviesThisMonth: movieIdsThisMonth.size,
    episodesThisMonth,
    totalSeconds: computeWatchTime(items),
    topGenre,
  };
}

export const WatchStats: FC = () => {
  const [stats, setStats] = useState<Stats | null>(computeStats);
  const [open, setOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Genre data is backfilled asynchronously (ContinueWatching), so refresh
  // when stored entries change.
  useEffect(() => {
    const refresh = () => setStats(computeStats());
    window.addEventListener('watch-progress-updated', refresh);
    return () => window.removeEventListener('watch-progress-updated', refresh);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!stats || (stats.moviesThisMonth === 0 && stats.episodesThisMonth === 0 && stats.totalSeconds === 0)) {
    return null;
  }

  const rows: StatRow[] = [
    {
      icon: Film,
      value: String(stats.moviesThisMonth),
      label: stats.moviesThisMonth === 1 ? 'Movie this month' : 'Movies this month',
    },
    {
      icon: Tv,
      value: String(stats.episodesThisMonth),
      label: stats.episodesThisMonth === 1 ? 'Episode this month' : 'Episodes this month',
    },
    { icon: Clock, value: formatWatchTime(stats.totalSeconds), label: 'Time watched' },
  ];

  if (stats.topGenre) {
    rows.push({ icon: Sparkles, value: stats.topGenre, label: 'Most watched genre' });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Watch statistics"
        aria-expanded={open}
        className={`inline-flex items-center justify-center w-11 h-11 rounded-xl border-2 transition-colors cursor-pointer ${
          open
            ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300'
            : 'bg-slate-800 border-slate-700 text-slate-200 hover:border-cyan-500 hover:text-white'
        }`}
      >
        <BarChart3 className="w-5 h-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/50 p-2 z-50">
          <div className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Your Stats
          </div>
          {rows.map(({ icon: Icon, value, label }) => (
            <div
              key={label}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800/60 transition-colors"
            >
              <Icon className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="text-sm font-bold text-white">{value}</span>
              <span className="text-xs text-slate-400 ml-auto text-right">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
