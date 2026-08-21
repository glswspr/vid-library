import type { FC } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Film, Search } from 'lucide-react';
import { SettingsMenu } from '../components/SettingsMenu';

export const FOCUS_SEARCH_EVENT = 'vdl:focus-search';

export const Navbar: FC = () => {
  const { pathname } = useLocation();
  const onHome = pathname === '/';

  const searchClasses =
    'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 border-2 border-slate-700 text-slate-200 font-bold text-sm hover:border-cyan-500 hover:text-white focus-visible:border-cyan-500 transition-colors cursor-pointer';

  return (
    <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Film className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-white tracking-tight">
            Vid<span className="text-cyan-400">Library</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {onHome ? (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event(FOCUS_SEARCH_EVENT))}
              className={searchClasses}
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
              <span>Search</span>
            </button>
          ) : (
            <Link
              to="/?focus=search"
              className={searchClasses}
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
              <span>Search</span>
            </Link>
          )}

          <SettingsMenu />

          <a
            href="https://adguard.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden lg:inline-flex text-xs text-slate-500 hover:text-cyan-400 transition-colors"
          >
            Tip: Use AdGuard to block popups and ads.
          </a>
        </div>
      </div>
    </header>
  );
};
