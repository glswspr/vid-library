import type { FC, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SearchResult } from '../services/catalog';
import { Film, Tv, Hash, Star, User, Share2, Check } from 'lucide-react';
import { useState } from 'react';

interface SearchResultsProps {
  results: SearchResult[];
  onSelect: (result?: SearchResult) => void;
  selectedIndex: number;
}

/** Copy `text` to the clipboard. Returns true on success. */
async function copyLink(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(ta);
    }
  }
}

export const SearchResults: FC<SearchResultsProps> = ({ results, onSelect, selectedIndex }) => {
  const navigate = useNavigate();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleClick = (result: SearchResult) => {
    if (result.type === 'person') {
      // Re-search with person's name to show their filmography
      onSelect(result);
      return;
    }
    const targetUrl =
      result.type === 'movie'
        ? `/movie/${result.imdbId}`
        : `/tv/${result.imdbId}`;
    navigate(targetUrl);
    onSelect();
  };

  const handleShare = async (e: React.MouseEvent, result: SearchResult) => {
    e.stopPropagation();
    // Build absolute URL from current origin
    const url = result.type === 'person'
      ? `${window.location.origin}/?q=${encodeURIComponent(result.title)}`
      : `${window.location.origin}${result.type === 'movie' ? '/movie' : '/tv'}/${result.imdbId}`;
    await copyLink(url);
    setCopiedId(result.imdbId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleKeyDown = (e: KeyboardEvent, result: SearchResult) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick(result);
    }
  };

  if (results.length === 0) return null;

  return (
    <div
      className="w-full max-w-3xl mx-auto bg-slate-900/90 border-2 border-slate-700/60 rounded-2xl overflow-hidden shadow-2xl shadow-black/30 backdrop-blur"
      role="listbox"
      aria-label="Search results"
      aria-live="polite"
    >
      <span className="sr-only">
        {results.length} result{results.length === 1 ? '' : 's'} found
      </span>
      {results.map((result, index) => {
        const isSelected = index === selectedIndex;

        if (result.type === 'person') {
          return (
            <div
              key={result.imdbId}
              role="option"
              aria-selected={isSelected}
              tabIndex={0}
              onClick={() => handleClick(result)}
              onKeyDown={(e) => handleKeyDown(e, result)}
              className={`flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors border-b border-slate-800/50 last:border-b-0 ${
                isSelected
                  ? 'bg-cyan-500/15 border-l-4 border-l-cyan-400 ring-1 ring-cyan-500/30'
                  : 'hover:bg-slate-800/60 focus-visible:bg-slate-800/80 focus-visible:ring-2 focus-visible:ring-cyan-500/40 border-l-4 border-l-transparent'
              }`}
            >
              {/* Poster/avatar */}
              <div className="w-14 h-20 rounded-lg overflow-hidden bg-slate-800 shrink-0 flex items-center justify-center border border-slate-700/50">
                {result.posterUrl ? (
                  <img
                    src={result.posterUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <User className="w-6 h-6 text-slate-600" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-100 truncate">{result.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-purple-400">
                    <User className="w-3.5 h-3.5" />
                    {result.known_for_department || 'Person'}
                  </span>
                </div>

                {result.known_for && result.known_for.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {result.known_for.slice(0, 3).map((kf) => (
                      <span key={kf.imdbId} className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded border border-slate-700/50">
                        {kf.title} ({kf.type === 'movie' ? 'Movie' : 'TV'})
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Share button */}
              <button
                onClick={(e) => handleShare(e, result)}
                className={`p-2 rounded-lg transition-colors shrink-0 ${
                  copiedId === result.imdbId
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/60 hover:text-slate-200'
                } border border-slate-700/50`}
                aria-label={`Copy link to ${result.title}`}
              >
                {copiedId === result.imdbId ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
              </button>

              {isSelected && (
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0 shadow-lg shadow-cyan-400/50" />
              )}
            </div>
          );
        }

        return (
          <div
            key={result.imdbId}
            role="option"
            aria-selected={isSelected}
            tabIndex={0}
            onClick={() => handleClick(result)}
            onKeyDown={(e) => handleKeyDown(e, result)}
            className={`flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors border-b border-slate-800/50 last:border-b-0 ${
              isSelected
                ? 'bg-cyan-500/15 border-l-4 border-l-cyan-400 ring-1 ring-cyan-500/30'
                : 'hover:bg-slate-800/60 focus-visible:bg-slate-800/80 focus-visible:ring-2 focus-visible:ring-cyan-500/40 border-l-4 border-l-transparent'
            }`}
          >
            {/* Poster thumbnail */}
            <div className="w-14 h-20 rounded-lg overflow-hidden bg-slate-800 shrink-0 flex items-center justify-center border border-slate-700/50">
              {result.posterUrl ? (
                <img
                  src={result.posterUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <Hash className="w-5 h-5 text-slate-600" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-slate-100 truncate">
                {result.title}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-slate-400">
                  {result.year || '—'}
                </span>
                {result.rating && (
                  <>
                    <span className="text-slate-700">·</span>
                    <span className="text-xs text-amber-400 font-semibold flex items-center gap-1">
                      <Star className="w-3 h-3 fill-current" />
                      {result.rating}
                    </span>
                  </>
                )}
                <span className="text-slate-700">·</span>
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${
                  result.type === 'movie' ? 'text-cyan-400' : 'text-indigo-400'
                }`}>
                  {result.type === 'movie' ? (
                    <Film className="w-3.5 h-3.5" />
                  ) : (
                    <Tv className="w-3.5 h-3.5" />
                  )}
                  {result.type === 'movie' ? 'Movie' : 'TV Series'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-1">
                IMDB: {result.imdbId}
              </p>
            </div>

            {/* Share button */}
            <button
              onClick={(e) => handleShare(e, result)}
              className={`p-2 rounded-lg transition-colors shrink-0 ${
                copiedId === result.imdbId
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/60 hover:text-slate-200'
              } border border-slate-700/50`}
              aria-label={`Copy link to ${result.title}`}
            >
              {copiedId === result.imdbId ? (
                <Check className="w-4 h-4" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
            </button>

            {/* Selected indicator */}
            {isSelected && (
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0 shadow-lg shadow-cyan-400/50" />
            )}
          </div>
        );
      })}
    </div>
  );
};
