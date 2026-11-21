import type { FC, ChangeEvent, KeyboardEvent } from 'react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Film, Search, X, Loader2, Clock } from 'lucide-react';
import { SettingsMenu } from '../components/SettingsMenu';
import { WatchStats } from '../components/WatchStats';
import { SearchResults } from './SearchResults';
import { searchByTitle, searchPersonCredits } from '../services/catalog';
import { resolveDirectImdbId, resolveImdbTitle, resolveTmdbFromImdb, detectMediaType } from '../services/metadata';
import type { SearchResult } from '../services/catalog';
import { SEARCH_DEBOUNCE_MS, MIN_SEARCH_QUERY_LENGTH } from '../constants';

export const FOCUS_SEARCH_EVENT = 'vdl:focus-search';

export const Navbar: FC = () => {
  const navigate = useNavigate();

  const [searchText, setSearchText] = useState<string>('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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
      setSelectedIndex(-1);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setSelectedIndex(-1);

    try {
      const imdbId = resolveDirectImdbId(query)?.imdbId;
      if (imdbId) {
        console.debug('[Navbar] Processing IMDB ID:', imdbId);

        // Try Wikidata first for rich metadata (title, year, seasonsCount)
        const wikidataResult = await resolveImdbTitle(imdbId, signal);
        if (signal.aborted) return;
        console.debug('[Navbar] Wikidata result:', wikidataResult);

        // Determine type using multiple fallbacks:
        // 1. Wikidata seasonsCount if available
        // 2. TMDB detection if available
        // 3. Default to 'movie' if undetermined
        let resolvedType: 'movie' | 'tv' = 'movie';
        if (wikidataResult?.seasonsCount !== undefined) {
          resolvedType = wikidataResult.seasonsCount > 0 ? 'tv' : 'movie';
          console.debug('[Navbar] Using Wikidata seasonsCount:', resolvedType);
        } else {
          try {
            const tmdbType = await detectMediaType(imdbId, signal);
            if (signal.aborted) return;
            if (tmdbType === 'movie' || tmdbType === 'tv') {
              resolvedType = tmdbType;
              console.debug('[Navbar] Using TMDB detection:', resolvedType);
            }
          } catch (e) {
            console.debug('[Navbar] TMDB detection error:', e);
          }
        }
        console.debug('[Navbar] Final resolvedType:', resolvedType);

        // Get poster from TMDB using the determined type
        const tmdbResolved = await resolveTmdbFromImdb(imdbId, resolvedType, signal);
        if (signal.aborted) return;
        const result: SearchResult = {
          imdbId,
          title: wikidataResult?.title || imdbId.toUpperCase(),
          year: wikidataResult?.year,
          type: resolvedType,
          posterUrl: tmdbResolved?.posterPath
            ? `https://image.tmdb.org/t/p/w92${tmdbResolved.posterPath}`
            : undefined,
        };
        setResults([result]);
      } else {
        const searchResults = await searchByTitle(query, signal);
        if (signal.aborted) return;
        setResults(searchResults);
      }
    } catch (e) {
      // An aborted request is expected when a newer query arrives — leave the
      // current results (or the newer query's results) in place.
      if (signal.aborted || (e instanceof DOMException && e.name === 'AbortError')) return;
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
    setSelectedIndex(-1);
    if (abortRef.current) {
      abortRef.current.abort();
    }
    searchInputRef.current?.focus();
  };

  const handleSearchKeyDown = async (e: KeyboardEvent<HTMLInputElement>) => {
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
        const target = selectedIndex >= 0 && selectedIndex < results.length
          ? results[selectedIndex]
          : results.length === 1 ? results[0] : null;
        if (!target) break;
        if (target.type === 'person' && target.tmdbId) {
          setIsSearching(true);
          const credits = await searchPersonCredits(target.tmdbId);
          setResults(credits);
          setSearchText(target.title);
          setIsSearching(false);
        } else if (target.type === 'person') {
          // No TMDB id, fall back to re-search by name
          setSearchText(target.title);
          performSearch(target.title);
        } else {
          navigate(
            target.type === 'movie'
              ? `/movie/${target.imdbId}`
              : `/tv/${target.imdbId}`
          );
          setSearchText('');
          setResults([]);
          setHasSearched(false);
        }
        break;
      case 'Escape':
        handleClearSearch();
        break;
    }
  };

  useEffect(() => {
    const handleFocusSearch = () => searchInputRef.current?.focus();
    window.addEventListener(FOCUS_SEARCH_EVENT, handleFocusSearch);
    return () => window.removeEventListener(FOCUS_SEARCH_EVENT, handleFocusSearch);
  }, []);

  // The home page owns `?q=` deep links. Handling the same param here ran the
  // query twice and rendered two result lists with the same DOM id.

  useEffect(() => {
    const debounce = debounceRef;
    const abort = abortRef;
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
      if (abort.current) abort.current.abort();
    };
  }, []);

  return (
    <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-50">
      <nav aria-label="Main" className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Film className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-white tracking-tight">
            Vid<span className="text-cyan-400">Library</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <WatchStats />
          
          <Link
            to="/watch-history"
            className="inline-flex items-center justify-center w-11 h-11 rounded-xl border-2 bg-slate-800 border-slate-700 text-slate-200 hover:border-cyan-500 hover:text-white hover:bg-slate-800/50 transition-colors cursor-pointer"
            aria-label="Watch History"
          >
            <Clock className="w-5 h-5" />
          </Link>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {isSearching ? (
                <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
              ) : (
                <Search className="w-4 h-4 text-slate-400" />
              )}
            </div>
            
            <input
              ref={searchInputRef}
              type="text"
              value={searchText}
              onChange={handleSearchInput}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search..."
              className="w-56 bg-slate-800 border-2 border-slate-700 focus:border-cyan-400 rounded-xl pl-10 pr-10 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
              aria-label="Search movies and TV shows"
              aria-controls="navbar-search-results"
              aria-expanded={results.length > 0}
            />
            
            {searchText && (
              <button
                onClick={handleClearSearch}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            
            {hasSearched && !isSearching && searchText.trim().length >= MIN_SEARCH_QUERY_LENGTH && (
              <div className="absolute left-0 right-0 mt-2" id="navbar-search-results">
                {results.length > 0 ? (
                  <SearchResults
                    results={results}
                    onSelect={(result) => {
                      if (result?.type === 'person') {
                        if (result.tmdbId) {
                          setSearchText(result.title);
                          setIsSearching(true);
                          searchPersonCredits(result.tmdbId).then((credits) => {
                            setResults(credits);
                            setIsSearching(false);
                          });
                        } else {
                          setSearchText(result.title);
                          performSearch(result.title);
                        }
                        return;
                      }
                      setSearchText('');
                      setResults([]);
                      setHasSearched(false);
                    }}
                    selectedIndex={selectedIndex}
                  />
                ) : (
                  <div className="px-4 py-2 text-center text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800/50">
                    <p className="text-xs">No results for <span className="text-slate-300">"{searchText}"</span></p>
                  </div>
                )}
              </div>
            )}
            
            {isSearching && (
              <div className="absolute left-0 right-0 mt-2 px-4 py-2 text-center text-slate-400 bg-slate-900/30 rounded-xl border border-slate-800/30">
                <Loader2 className="w-5 h-5 mx-auto mb-2 text-cyan-400 animate-spin" />
              </div>
            )}
          </div>
          
          <SettingsMenu />
        </div>
      </nav>
    </header>
  );
};
