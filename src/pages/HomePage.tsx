import { useEffect, useState, useRef, useCallback } from 'react';
import type { FC, ChangeEvent, KeyboardEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { SearchResult } from '../services/catalog';
import { searchByTitle } from '../services/catalog';
import { SearchResults } from '../components/SearchResults';
import { ContinueWatching } from '../components/ContinueWatching';
import { MyList } from '../components/MyList';
import { Trending } from '../components/Trending';
import { HomeRows } from '../components/HomeRows';
import { NewEpisodes } from '../components/NewEpisodes';
import { FOCUS_SEARCH_EVENT } from '../components/Navbar';
import { useTvInitialFocus } from '../hooks/useTvInitialFocus';
import { isTvDevice } from '../utils/tv';
import { Search, X, Loader2, AlertTriangle } from 'lucide-react';
import { SEARCH_DEBOUNCE_MS, MIN_SEARCH_QUERY_LENGTH } from '../constants';

export const HomePage: FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [searchText, setSearchText] = useState<string>('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // TV: focus a primary action so the D-pad has a starting point.
  useTvInitialFocus(mainRef);

  // Focus the search field when arriving via the navbar/hero Search button.
  // On desktop, focus it by default; on TV never pop the on-screen keyboard
  // unless the user explicitly opened search.
  useEffect(() => {
    if (searchParams.get('focus') === 'search') {
      searchInputRef.current?.focus();
    } else if (!isTvDevice()) {
      searchInputRef.current?.focus();
    }
  }, [searchParams]);

  // The navbar's Search button dispatches this when we're already on the home
  // page — focus the box without triggering a navigation.
  useEffect(() => {
    const onFocusSearch = () => searchInputRef.current?.focus();
    window.addEventListener(FOCUS_SEARCH_EVENT, onFocusSearch);
    return () => window.removeEventListener(FOCUS_SEARCH_EVENT, onFocusSearch);
  }, []);

  useEffect(() => {
    document.title = 'VidLibrary — Watch movies & TV shows';
  }, []);

  const performSearch = useCallback(async (query: string) => {
    // Cancel any in-flight request so a slower earlier keystroke can never
    // overwrite a newer result, and mark it superseded.
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    if (query.trim().length < MIN_SEARCH_QUERY_LENGTH) {
      setResults([]);
      setHasSearched(false);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);
    setSelectedIndex(-1);

    try {
      const searchResults = await searchByTitle(query, signal);
      if (signal.aborted) return;
      setResults(searchResults);
    } catch (e) {
      // An aborted request is expected when a newer query arrives — the newer
      // query owns the UI state now.
      if (signal.aborted || (e instanceof DOMException && e.name === 'AbortError')) return;
      setSearchError('Search unavailable. Add a free TMDB API key in .env for full search.');
      setResults([]);
    } finally {
      if (!signal.aborted) setIsSearching(false);
    }
  }, []);

  const handleSearchInput = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchText(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      performSearch(value);
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleClearSearch = () => {
    setSearchText('');
    setResults([]);
    setHasSearched(false);
    setSearchError(null);
    setSelectedIndex(-1);
    if (abortRef.current) {
      abortRef.current.abort();
    }
    searchInputRef.current?.focus();
  };

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          const result = results[selectedIndex];
          navigate(
            result.type === 'movie'
              ? `/movie/${result.imdbId}`
              : `/tv/${result.imdbId}`
          );
        } else if (results.length === 1) {
          // Auto-navigate if only one result
          const result = results[0];
          navigate(
            result.type === 'movie'
              ? `/movie/${result.imdbId}`
              : `/tv/${result.imdbId}`
          );
        }
        break;
      case 'Escape':
        handleClearSearch();
        break;
    }
  };

  // Handle pre-filled query from old-style ?q= URL param
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setSearchText(q);
      performSearch(q);
    }
  }, [searchParams, performSearch]);

  useEffect(() => {
    const debounce = debounceRef;
    const abort = abortRef;
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
      if (abort.current) abort.current.abort();
    };
  }, []);

  const handleResultSelect = () => {
    setSearchText('');
    setResults([]);
    setHasSearched(false);
  };

  return (
    <div ref={mainRef} className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Search */}
      <div className="max-w-3xl mx-auto mb-12">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
            {isSearching ? (
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
            ) : (
              <Search className="w-6 h-6 text-slate-400" />
            )}
          </div>

          <input
            ref={searchInputRef}
            type="text"
            value={searchText}
            onChange={handleSearchInput}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search..."
            className="w-full bg-slate-800/80 border-2 border-slate-700/80 focus:border-cyan-400 rounded-2xl pl-14 pr-14 py-5 text-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-4 focus:ring-cyan-500/20 transition-all"
            aria-label="Search movies and TV shows"
            aria-autocomplete="list"
            aria-controls="search-results"
            aria-expanded={results.length > 0}
            role="combobox"
          />

          {searchText && (
            <button
              onClick={handleClearSearch}
              className="absolute inset-y-0 right-0 pr-5 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        <div className="mt-3 text-center">
          <a
            href="https://adguard.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-500 hover:text-cyan-400 transition-colors"
          >
            Tip: Use AdGuard to block popups and ads.
          </a>
        </div>

        {/* Search results */}
        {hasSearched && !isSearching && searchText.trim().length >= MIN_SEARCH_QUERY_LENGTH && (
          <div className="mt-4" id="search-results">
            {searchError ? (
              <div className="flex items-center gap-3 px-5 py-4 bg-rose-500/5 border border-rose-500/20 rounded-2xl text-base text-rose-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>{searchError}</span>
              </div>
            ) : results.length > 0 ? (
              <SearchResults
                results={results}
                onSelect={handleResultSelect}
                selectedIndex={selectedIndex}
              />
            ) : (
              <div className="px-4 py-6 text-center text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800/50">
                <p className="text-sm">No results for <span className="text-slate-300">"{searchText}"</span></p>
              </div>
            )}
          </div>
        )}

        {isSearching && (
          <div className="mt-3 px-4 py-6 text-center text-slate-400 bg-slate-900/30 rounded-xl border border-slate-800/30">
            <Loader2 className="w-5 h-5 mx-auto mb-2 text-cyan-400 animate-spin" />
          </div>
        )}
      </div>

      {/* Continue Watching */}
      <ContinueWatching />

      {/* New Episodes */}
      <NewEpisodes />

      {/* My List */}
      <MyList />

      {/* Recommendations (Trending Movies / Trending TV Shows) */}
      <Trending />

      {/* Curated rows: Top Rated, Because You Watched, Genre rows */}
      <HomeRows />
    </div>
  );
};
