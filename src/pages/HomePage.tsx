import { useEffect, useState, useRef, useCallback } from 'react';
import type { FC, ChangeEvent, KeyboardEvent, FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { SearchResult } from '../services/catalog';
import { searchByTitle } from '../services/catalog';
import { extractImdbId } from '../utils/imdb';
import { SearchResults } from '../components/SearchResults';
import { ContinueWatching } from '../components/ContinueWatching';
import { MyList } from '../components/MyList';
import { Trending } from '../components/Trending';
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

  const [imdbInput, setImdbInput] = useState<string>('');
  const [imdbError, setImdbError] = useState<string | null>(null);

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
    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }

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
      const searchResults = await searchByTitle(query);
      setResults(searchResults);
    } catch {
      setSearchError('Search unavailable. Add a free TMDB API key in .env for full search.');
      setResults([]);
    } finally {
      setIsSearching(false);
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

  const handleImdbSubmit = (e: FormEvent) => {
    e.preventDefault();
    setImdbError(null);

    const imdbId = extractImdbId(imdbInput);
    if (!imdbId) {
      setImdbError('Please enter a valid IMDb ID (e.g. tt0120737)');
      return;
    }

    // Navigate directly — the player page will handle type detection
    navigate(`/movie/${imdbId}`);
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

        {/* Search results */}
        {hasSearched && !isSearching && searchText.trim().length >= MIN_SEARCH_QUERY_LENGTH && (
          <div className="mt-4" id="search-results" role="listbox">
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

      {/* IMDb ID entry */}
      <form onSubmit={handleImdbSubmit} className="flex gap-2 mb-12">
        <div className="flex-1 relative">
          <input
            type="text"
            value={imdbInput}
            onChange={(e) => {
              setImdbInput(e.target.value);
              setImdbError(null);
            }}
            placeholder="tt1234567 or IMDb URL"
            className="w-full bg-slate-800/60 border-2 border-slate-700/60 focus:border-cyan-500 rounded-xl px-4 py-3.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
          />
        </div>
        <button
          type="submit"
          className="px-6 py-3.5 bg-cyan-500 text-slate-950 font-bold text-sm rounded-xl hover:bg-cyan-400 transition-colors cursor-pointer shrink-0"
        >
          Open
        </button>
      </form>

      {imdbError && (
        <p className="text-xs text-rose-400 -mt-10 mb-4 px-1">{imdbError}</p>
      )}

      {/* Continue Watching */}
      <ContinueWatching />

      {/* My List */}
      <MyList />

      {/* Recommendations (Trending Movies / Trending TV Shows) */}
      <Trending />
    </div>
  );
};
