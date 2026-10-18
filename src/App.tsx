import { useEffect, useRef } from 'react';
import type { FC } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigationType } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomePage } from './pages/HomePage';
import { MoviePage } from './pages/MoviePage';
import { TVShowPage } from './pages/TVShowPage';
import { WatchHistoryPage } from './pages/WatchHistoryPage';
import { NotFound } from './pages/NotFound';
import { Navbar } from './components/Navbar';
import { useSpatialNav } from './hooks/useSpatialNav';
import { useSettings } from './hooks/useSettings';
import { OfflineBanner } from './components/OfflineBanner';
import { scrollToVideoPlayer } from './utils/scroll';

function AccentApplier() {
  const [settings] = useSettings();
  useEffect(() => {
    const root = document.documentElement;
    const accent = settings.accentColor;
    root.style.setProperty('--accent', accent);
    // Tailwind utilities resolve to `var(--color-cyan-*)`, so remapping that
    // scale is what makes the picker change the actual UI. Inline custom
    // properties also win over the light-theme block in index.css.
    const shades: Record<string, string> = {
      '300': `color-mix(in srgb, ${accent} 60%, white)`,
      '400': accent,
      '500': accent,
      '600': `color-mix(in srgb, ${accent} 88%, black)`,
      '700': `color-mix(in srgb, ${accent} 75%, black)`,
    };
    for (const [step, value] of Object.entries(shades)) {
      root.style.setProperty(`--color-cyan-${step}`, value);
    }
  }, [settings.accentColor]);
  return null;
}

function ThemeApplier() {
  const [settings] = useSettings();
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
  }, [settings.theme]);
  return null;
}

function ScrollManager() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const prevPathname = useRef<string>('');

  useEffect(() => {
    if (navigationType === 'POP') {
      const saved = sessionStorage.getItem(`scroll:${pathname}`);
      requestAnimationFrame(() => {
        window.scrollTo(0, saved ? Number(saved) : 0);
      });
    } else if (isSameShowEpisode(prevPathname.current, pathname)) {
      // User clicked an episode thumbnail within the same show.
      // Scroll to the video player (centered) — same as the
      // "Scroll To Video" button — instead of restoring a stale
      // saved scroll position.
      requestAnimationFrame(() => {
        scrollToVideoPlayer();
      });
    } else {
      window.scrollTo(0, 0);
    }
    prevPathname.current = pathname;

    return () => {
      sessionStorage.setItem(`scroll:${pathname}`, String(window.scrollY));
    };
  }, [pathname, navigationType]);

  return null;
}

function isSameShowEpisode(from: string, to: string): boolean {
  if (!from || !to) return false;
  const re = /^\/tv\/([^/]+)\/season\/\d+\/episode\/\d+$/;
  const a = from.match(re);
  const b = to.match(re);
  return !!a && !!b && a[1] === b[1];
}

export const App: FC = () => {
  useSpatialNav();

  return (
    <Router>
      <ScrollManager />
       <AccentApplier />
       <ThemeApplier />
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-cyan-500 selection:text-slate-950">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[70] focus:top-3 focus:left-3 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-cyan-500 focus:text-slate-950 focus:font-bold focus:text-sm"
      >
        Skip to content
      </a>
      <Navbar />
      <ErrorBoundary>
        <OfflineBanner />
        <main id="main-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/watch-history" element={<WatchHistoryPage />} />
            <Route path="/movie/:id" element={<MoviePage />} />
            <Route path="/tv/:id" element={<TVShowPage />} />
            <Route path="/tv/:id/season/:season/episode/:episode" element={<TVShowPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </ErrorBoundary>
    </div>
    </Router>
  );
};

export default App;
