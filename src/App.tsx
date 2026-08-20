import { useEffect, useRef } from 'react';
import type { FC } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigationType } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomePage } from './pages/HomePage';
import { MoviePage } from './pages/MoviePage';
import { TVShowPage } from './pages/TVShowPage';
import { NotFound } from './pages/NotFound';
import { useSpatialNav } from './hooks/useSpatialNav';

/**
 * Saves each route's scroll position and restores it when the user navigates
 * back (POP), so returning from a title lands where you left off. Non-back
 * navigation scrolls to the top as usual.
 */
function ScrollManager() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const prevPathname = useRef<string>('');

  useEffect(() => {
    if (navigationType === 'POP') {
      const saved = sessionStorage.getItem(`scroll:${pathname}`);
      // Wait a frame so the new route has laid out before scrolling.
      requestAnimationFrame(() => {
        window.scrollTo(0, saved ? Number(saved) : 0);
      });
    } else if (isSameShowEpisode(prevPathname.current, pathname)) {
      // Navigating between episodes of the same show — keep current scroll.
      const saved = sessionStorage.getItem(`scroll:${pathname}`);
      requestAnimationFrame(() => {
        window.scrollTo(0, saved ? Number(saved) : 0);
      });
    } else {
      window.scrollTo(0, 0);
    }
    prevPathname.current = pathname;

    return () => {
      // Runs just before the next route's effect — capture this page's scroll.
      sessionStorage.setItem(`scroll:${pathname}`, String(window.scrollY));
    };
  }, [pathname, navigationType]);

  return null;
}

/**
 * True when both routes are episode pages of the same TV show
 * (`/tv/{id}/season/{s}/episode/{e}`), so episode clicks don't jump to top.
 */
function isSameShowEpisode(from: string, to: string): boolean {
  if (!from || !to) return false;
  const re = /^\/tv\/([^/]+)\/season\/\d+\/episode\/\d+$/;
  const a = from.match(re);
  const b = to.match(re);
  return !!a && !!b && a[1] === b[1];
}

export const App: FC = () => {
  // D-pad / arrow-key spatial navigation + Back/Escape handling (TV remotes).
  useSpatialNav();

  return (
    <Router>
      <ScrollManager />
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-cyan-500 selection:text-slate-950">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/movie/:id" element={<MoviePage />} />
            <Route path="/tv/:id" element={<TVShowPage />} />
            <Route path="/tv/:id/season/:season/episode/:episode" element={<TVShowPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>

        <footer className="border-t border-slate-800/60 mt-16 py-6 px-4 text-center">
          <p className="text-sm text-slate-500">
            Tip: Use{' '}
            <a
              href="https://adguard.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
            >
              AdGuard
            </a>{' '}
            to block popups and ads.
          </p>
        </footer>
      </div>
    </Router>
  );
};

export default App;
