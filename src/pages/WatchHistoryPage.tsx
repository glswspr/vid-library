import { useEffect, useState, useCallback, useMemo } from 'react';
import type { FC } from 'react';
import { Link } from 'react-router-dom';
import { getAllWatchProgress, removeWatchProgress, saveWatchProgress } from '../utils/storage';
import type { WatchProgress } from '../types';
import { Clock, Trash2, Film, Tv, Search, Filter, Grid3X3, List, X, BarChart3, CheckCircle, PlayCircle } from 'lucide-react';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';

type LayoutMode = 'grid' | 'list';
type FilterType = 'all' | 'movie' | 'tv';
type FilterStatus = 'all' | 'in-progress' | 'completed';
type SortKey = 'recent' | 'oldest' | 'title-az' | 'title-za' | 'progress-desc' | 'progress-asc';

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

const formatProgress = (progress: number, duration: number): string => {
  if (duration === 0) return '0%';
  return `${Math.round((progress / duration) * 100)}%`;
};

const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDateGroup = (timestamp: number, now: Date): string => {
  const date = new Date(timestamp);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffDays = Math.floor((today.getTime() - itemDate.getTime()) / 86400000);

  if (itemDate >= today) return 'Today';
  if (itemDate >= yesterday) return 'Yesterday';
  if (diffDays <= 7) return 'This Week';
  if (diffDays <= 30) return 'This Month';
  if (diffDays <= 365) {
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  return date.toLocaleDateString(undefined, { year: 'numeric' });
};

export const WatchHistoryPage: FC = () => {
  const [items, setItems] = useState<WatchProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortBy, setSortBy] = useState<SortKey>('recent');
  const [layout, setLayout] = useState<LayoutMode>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [undoStack, setUndoStack] = useState<WatchProgress[] | null>(null);

  const refresh = useCallback(() => {
    setItems(getAllWatchProgress());
  }, []);

  useEffect(() => {
    refresh();
    setLoading(false);

    window.addEventListener('watch-progress-updated', refresh);
    window.addEventListener('storage', refresh);

    return () => {
      window.removeEventListener('watch-progress-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [refresh]);

  const handleRemove = (id: string, seasonNumber?: number, episodeNumber?: number) => {
    removeWatchProgress(id, seasonNumber, episodeNumber);
    refresh();
  };

  const handleClearAll = () => {
    setShowClearModal(true);
  };

  const confirmClearAll = () => {
    const allItems = getAllWatchProgress();
    setUndoStack(allItems);
    localStorage.removeItem('vid_library_progress_v2');
    refresh();
    setShowClearModal(false);
  };

  const handleUndoClear = () => {
    if (undoStack) {
      undoStack.forEach((item) => saveWatchProgress(item));
      refresh();
      setUndoStack(null);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterType('all');
    setFilterStatus('all');
    setSortBy('recent');
  };

  const hasActiveFilters = searchQuery.length > 0 || filterType !== 'all' || filterStatus !== 'all';

  const filteredAndSorted = useMemo(() => {
    let result = [...items];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item) => item.title.toLowerCase().includes(q));
    }

    if (filterType !== 'all') {
      result = result.filter((item) => item.type === filterType);
    }

    if (filterStatus === 'in-progress') {
      result = result.filter((item) => !item.completed);
    } else if (filterStatus === 'completed') {
      result = result.filter((item) => item.completed);
    }

    switch (sortBy) {
      case 'recent':
        result.sort((a, b) => b.updatedAt - a.updatedAt);
        break;
      case 'oldest':
        result.sort((a, b) => a.updatedAt - b.updatedAt);
        break;
      case 'title-az':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title-za':
        result.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'progress-desc':
        result.sort((a, b) => {
          const pa = a.duration > 0 ? a.progress / a.duration : 0;
          const pb = b.duration > 0 ? b.progress / b.duration : 0;
          return pb - pa;
        });
        break;
      case 'progress-asc':
        result.sort((a, b) => {
          const pa = a.duration > 0 ? a.progress / a.duration : 0;
          const pb = b.duration > 0 ? b.progress / b.duration : 0;
          return pa - pb;
        });
        break;
    }

    return result;
  }, [items, searchQuery, filterType, filterStatus, sortBy]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, WatchProgress[]> = {};
    const now = new Date();
    for (const item of filteredAndSorted) {
      const group = formatDateGroup(item.updatedAt, now);
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
    }
    return Object.entries(groups).sort(([a], [b]) => {
      const order: Record<string, number> = {
        Today: 0, Yesterday: 1, 'This Week': 2, 'This Month': 3,
      };
      const oa = order[a] ?? 4;
      const ob = order[b] ?? 4;
      if (oa !== ob) return oa - ob;
      return b.localeCompare(a);
    });
  }, [filteredAndSorted]);

  const totalDuration = useMemo(
    () => filteredAndSorted.reduce((sum, item) => sum + item.progress, 0),
    [filteredAndSorted],
  );

  // ---- Render helpers ----

  const renderThumbnail = (item: WatchProgress, sizeClass: string) => (
    <>
      {item.posterUrl ? (
        <img
          src={item.posterUrl}
          alt={item.title}
          className={`w-full ${sizeClass} object-cover rounded-xl`}
          loading="lazy"
        />
      ) : (
        <div
          className={`w-full ${sizeClass} bg-slate-800/60 rounded-xl flex items-center justify-center`}
        >
          {item.type === 'movie' ? (
            <Film className="w-6 h-6 text-slate-500" />
          ) : (
            <Tv className="w-6 h-6 text-slate-500" />
          )}
        </div>
      )}
    </>
  );

  const renderProgressOverlay = (item: WatchProgress, showPercent: boolean) => {
    const percent = item.duration > 0 ? Math.min(100, Math.round((item.progress / item.duration) * 100)) : 0;
    return (
      <>
        {item.completed && (
          <div className="absolute top-2 right-2 bg-green-500/90 text-white text-xs font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
            <CheckCircle className="w-3 h-3 fill-current" />
            Watched
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-800">
          <div className="h-full bg-cyan-400" style={{ width: `${percent}%` }} />
        </div>
        {showPercent && percent > 0 && !item.completed && (
          <span className="absolute bottom-2 right-2 text-[10px] font-mono bg-black/60 text-cyan-300 px-1 py-0.5 rounded">
            {percent}%
          </span>
        )}
      </>
    );
  };

  const renderRemoveButton = (
    item: WatchProgress,
    onClick: (e: React.MouseEvent) => void,
    position: 'top-left' | 'top-right',
  ) => {
    const pos =
      position === 'top-left'
        ? 'top-2 left-2'
        : 'top-2 right-2';
    return (
      <button
        onClick={onClick}
        className={`absolute ${pos} opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-slate-900/80 hover:bg-rose-500/80 text-slate-300 hover:text-white rounded-lg`}
        aria-label={`Remove ${item.title} from history`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    );
  };

  // ---- Loading skeleton ----

  if (loading) {
    return (
      <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Clock className="w-8 h-8 text-cyan-400" />
          <h1 className="text-2xl font-bold text-white tracking-tight">Watch History</h1>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[2/3] w-full bg-slate-800/60 rounded-lg" />
              <div className="h-3 w-3/4 bg-slate-800/60 rounded mt-2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---- Empty state ----

  if (items.length === 0) {
    return (
      <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Clock className="w-8 h-8 text-cyan-400" />
          <h1 className="text-2xl font-bold text-white tracking-tight">Watch History</h1>
        </div>
        <div className="text-center py-16">
          <Clock className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-300 mb-2">No watch history yet</h2>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">
            Start watching something and it will appear here automatically.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl transition-colors"
          >
            <Film className="w-5 h-5" />
            Browse Movies & TV
          </Link>
        </div>
      </div>
    );
  }

  // ---- Main content ----

  const totalWatchTime = formatDuration(totalDuration);
  const itemCount = filteredAndSorted.length;

  return (
    <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Clock className="w-8 h-8 text-cyan-400" />
          <h1 className="text-2xl font-bold text-white tracking-tight">Watch History</h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Layout toggle */}
          <div className="hidden sm:flex items-center gap-0.5 bg-slate-800 rounded-lg p-1 border border-slate-700">
            <button
              onClick={() => setLayout('grid')}
              aria-label="Grid view"
              aria-pressed={layout === 'grid'}
              className={`p-2 rounded-md transition-all cursor-pointer ${
                layout === 'grid'
                  ? 'bg-cyan-500 text-slate-900'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setLayout('list')}
              aria-label="List view"
              aria-pressed={layout === 'list'}
              className={`p-2 rounded-md transition-all cursor-pointer ${
                layout === 'list'
                  ? 'bg-cyan-500 text-slate-900'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Filter toggle (mobile) */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`sm:hidden flex items-center gap-2 px-3 py-2 border rounded-xl text-sm font-medium transition-all cursor-pointer ${
              showFilters || hasActiveFilters
                ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
            }`}
          >
            <Filter className="w-4 h-4" />
            {hasActiveFilters && (
              <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
            )}
          </button>

          {/* Clear All */}
          <button
            onClick={handleClearAll}
            className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:text-rose-300 rounded-xl text-sm font-medium transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </button>
        </div>
      </div>

      {/* Stats summary */}
      <div className="flex items-center gap-4 text-sm text-slate-400 mb-4">
        <span className="flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-cyan-400" />
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </span>
        <span className="w-1 h-1 bg-slate-600 rounded-full" />
        <span className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-cyan-400" />
          {totalWatchTime} watched
        </span>
      </div>

      {/* Filter bar */}
      <div className={`mb-6 space-y-4 ${!showFilters && !hasActiveFilters ? 'hidden sm:block' : ''}`}>
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 focus:border-cyan-500 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all cursor-pointer ${
                filterType === 'all'
                  ? 'bg-cyan-500 text-slate-900'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('movie')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all cursor-pointer flex items-center gap-1 ${
                filterType === 'movie'
                  ? 'bg-cyan-500 text-slate-900'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Film className="w-3 h-3" /> Movies
            </button>
            <button
              onClick={() => setFilterType('tv')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all cursor-pointer flex items-center gap-1 ${
                filterType === 'tv'
                  ? 'bg-cyan-500 text-slate-900'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Tv className="w-3 h-3" /> TV
            </button>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all cursor-pointer ${
                filterStatus === 'all'
                  ? 'bg-cyan-500 text-slate-900'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('in-progress')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all cursor-pointer ${
                filterStatus === 'in-progress'
                  ? 'bg-cyan-500 text-slate-900'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              In Progress
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all cursor-pointer ${
                filterStatus === 'completed'
                  ? 'bg-cyan-500 text-slate-900'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Completed
            </button>
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="bg-slate-800 border border-slate-700 focus:border-cyan-500 text-slate-200 rounded-xl px-3 py-2 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
          >
            <option value="recent">Recently Watched</option>
            <option value="oldest">Oldest First</option>
            <option value="title-az">Title A–Z</option>
            <option value="title-za">Title Z–A</option>
            <option value="progress-desc">Most Progress</option>
            <option value="progress-asc">Least Progress</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Grid empty state after filtering */}
      {itemCount === 0 && items.length > 0 ? (
        <div className="text-center py-12">
          <Filter className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-300 mb-1">No matching items</h3>
          <p className="text-slate-500 text-sm mb-4">
            Try adjusting your search or filter criteria.
          </p>
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 text-slate-200 hover:border-cyan-500 rounded-xl text-sm font-medium transition-all cursor-pointer"
          >
            Clear all filters
          </button>
        </div>
      ) : layout === 'grid' ? (
        /* Grid layout */
        groupedItems.map(([groupName, groupItems]) => (
          <div key={groupName} className="mb-8">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">
              {groupName}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {groupItems.map((item) => {
                return (
                  <Link
                    key={item.seasonNumber && item.episodeNumber ? `${item.id}_s${item.seasonNumber}e${item.episodeNumber}` : item.id}
                    to={item.type === 'movie' ? `/movie/${item.id}` : (item.seasonNumber && item.episodeNumber ? `/tv/${item.id}/season/${item.seasonNumber}/episode/${item.episodeNumber}` : `/tv/${item.id}`)}
                    className="group relative bg-slate-900/50 rounded-xl border border-slate-800/50 hover:border-cyan-500/50 hover:bg-slate-900 transition-all"
                  >
                    <div className="relative">
                      {renderThumbnail(item, 'aspect-[2/3]')}

                      {renderProgressOverlay(item, true)}

                      {renderRemoveButton(item, (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRemove(item.id, item.seasonNumber, item.episodeNumber);
                      }, 'top-right')}
                    </div>

                    <div className="p-2">
                      <h3 className="font-semibold text-white text-sm truncate group-hover:text-cyan-400 transition-colors line-clamp-1">
                        {item.title}
                      </h3>
                      <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                        <Clock className="w-3 h-3" />
                        <span className="truncate">
                          {formatProgress(item.progress, item.duration)}
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className="truncate">
                          {formatDuration(item.progress)} / {formatDuration(item.duration)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500 truncate">
                        {item.type === 'movie' ? 'Movie' : `S${item.seasonNumber?.toString().padStart(2, '0')} E${item.episodeNumber?.toString().padStart(2, '0')}`}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))
      ) : (
        /* List layout */
        groupedItems.map(([groupName, groupItems]) => (
          <div key={groupName} className="mb-8">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">
              {groupName}
            </h2>
            <div className="space-y-2">
              {groupItems.map((item) => {
                const percent = item.duration > 0
                  ? Math.min(100, Math.round((item.progress / item.duration) * 100))
                  : 0;
                const isCompleted = item.completed;
                return (
                  <Link
                    key={item.seasonNumber && item.episodeNumber ? `${item.id}_s${item.seasonNumber}e${item.episodeNumber}` : item.id}
                    to={item.type === 'movie' ? `/movie/${item.id}` : (item.seasonNumber && item.episodeNumber ? `/tv/${item.id}/season/${item.seasonNumber}/episode/${item.episodeNumber}` : `/tv/${item.id}`)}
                    className="group relative flex items-center gap-3 bg-slate-900/30 rounded-xl p-2 border border-slate-800/50 hover:border-cyan-500/50 hover:bg-slate-900/50 transition-all"
                  >
                    <div className="relative w-16 h-24 shrink-0">
                      {renderThumbnail(item, 'w-full h-full')}
                      {renderProgressOverlay(item, false)}
                      {renderRemoveButton(item, (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRemove(item.id, item.seasonNumber, item.episodeNumber);
                      }, 'top-left')}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-white text-sm group-hover:text-cyan-400 transition-colors line-clamp-1">
                            {item.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                            {item.type === 'movie' ? (
                              <span className="flex items-center gap-1">
                                <Film className="w-3 h-3" /> Movie
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Tv className="w-3 h-3" />
                                S{item.seasonNumber?.toString().padStart(2, '0')} E{item.episodeNumber?.toString().padStart(2, '0')}
                              </span>
                            )}
                            {item.rating && <span>• {item.rating}★</span>}
                            {item.genre && <span>• {item.genre.split(',')[0]?.trim()}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 text-right">
                          <div className="text-right">
                            <div className="text-xs text-slate-300 font-mono">
                              {formatProgress(item.progress, item.duration)}
                            </div>
                            <div className="text-xs text-slate-500">
                              {formatDuration(item.progress)} / {formatDuration(item.duration)}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {formatDate(item.updatedAt)}
                            </div>
                          </div>
                          {isCompleted ? (
                            <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                          ) : (
                            <PlayCircle className="w-4 h-4 text-cyan-400 shrink-0" />
                          )}
                        </div>
                      </div>

                      <div className="absolute bottom-2 left-2 right-2 hidden sm:block">
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-cyan-400 rounded-full"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Clear All modal */}
      <Modal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        title="Clear watch history?"
        width="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            This will permanently remove <strong className="text-white">{items.length}</strong> {items.length === 1 ? 'item' : 'items'} from your watch history.
            This cannot be undone.
          </p>
          <p className="text-xs text-slate-500">
            Total watch time to be removed: <strong className="text-slate-300">{totalWatchTime}</strong>
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowClearModal(false)}
              className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={confirmClearAll}
              className="flex-1 px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer"
            >
              Clear All
            </button>
          </div>
        </div>
      </Modal>

      {/* Undo toast */}
      {undoStack && (
        <Toast
          message={`Cleared ${undoStack.length} ${undoStack.length === 1 ? 'item' : 'items'} from history`}
          actionLabel="Undo"
          onAction={handleUndoClear}
        />
      )}
    </div>
  );
};

export default WatchHistoryPage;
