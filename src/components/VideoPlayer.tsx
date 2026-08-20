import { useState, useEffect, useRef } from 'react';
import type { FC } from 'react';
import type { MediaItem } from '../types';
import { getProvider } from '../providers';
import {
  setPreferredProvider,
  getProviderFallbackOrder,
  rememberProvider,
  saveWatchProgress,
  getWatchProgress,
} from '../utils/storage';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import type { ProviderId } from '../types';
import { IFRAME_LOAD_TIMEOUT } from '../constants';

interface VideoPlayerProps {
  media: MediaItem;
  season?: number;
  episode?: number;
}

// Iframe embed servers only — the native/direct players were removed because
// they almost never worked.
const SERVER_BUTTONS: readonly { label: string; provider: ProviderId }[] = [
  { label: 'Server 1', provider: 'vidrock' },
  { label: 'Server 2', provider: 'vidapi' },
  { label: 'Server 3', provider: 'videasy' },
  { label: 'Server 4', provider: 'peachify' },
  { label: 'Server 5', provider: 'vidsrc' },
  { label: 'Server 6', provider: 'vidcore' },
  { label: 'Server 7', provider: 'vidzee' },
];

// Human-readable provider name to show under each server button.
const PROVIDER_NAMES: Record<ProviderId, string> = {
  videasy: 'Videasy',
  vidrock: 'VidRock',
  vidapi: 'VidAPI',
  peachify: 'Peachify',
  vidsrc: 'VidSrc',
  vidcore: 'VidCore',
  vidzee: 'VidZee',
};

export const VideoPlayer: FC<VideoPlayerProps> = ({ media, season, episode }) => {
  // Default to Server 1 (VidRock) on the player page.
  const [providerId, setProviderId] = useState<ProviderId>('vidrock');
  const [hasError, setHasError] = useState<boolean>(false);
  const [isIframeLoaded, setIsIframeLoaded] = useState<boolean>(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Set once the user manually picks a server this session.
  const manualOverrideRef = useRef(false);
  // Counts consecutive automatic server fallbacks so a string of failing
  // servers can't loop forever — we eventually show the error screen.
  const autoFallbackCountRef = useRef(0);
  // Compact server switcher: dropdown + quick cycle instead of a crowded row.
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const currentServer =
    SERVER_BUTTONS.find((b) => b.provider === providerId) ?? SERVER_BUTTONS[0];

  // Reset progress/state when the title changes — back to Server 1 (VidRock).
  useEffect(() => {
    setHasError(false);
    setIsIframeLoaded(false);
    autoFallbackCountRef.current = 0;
    if (!manualOverrideRef.current) {
      setProviderId('vidrock');
    }
  }, [media.id, media.tmdbId, season, episode]);

  const handleProviderChange = (newProvider: ProviderId) => {
    manualOverrideRef.current = true;
    setProviderId(newProvider);
    setPreferredProvider(newProvider);
    setHasError(false);
    setIsIframeLoaded(false);
  };

  // Close the server menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // Cycle to the next/previous server.
  const cycleServer = (dir: 1 | -1) => {
    const idx = SERVER_BUTTONS.findIndex((b) => b.provider === providerId);
    const next = SERVER_BUTTONS[(idx + dir + SERVER_BUTTONS.length) % SERVER_BUTTONS.length];
    autoFallbackCountRef.current = 0;
    handleProviderChange(next.provider);
    setMenuOpen(false);
  };

  // Listen for iframe postMessage status events
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      let data = event.data;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { return; }
      }
      if (!data) return;

      // Videoasy posts a JSON message with { timestamp, duration, season, episode }.
      if (typeof data.timestamp === 'number' || typeof data.progress === 'number') {
        const progress = data.timestamp || 0;
        const duration = data.duration || 0;
        if (progress > 0) {
          saveWatchProgress({
            id: media.id,
            title: media.title,
            type: media.type,
            posterUrl: media.posterUrl,
            seasonNumber: data.season ?? season,
            episodeNumber: data.episode ?? episode,
            progress,
            duration,
            completed: false,
            updatedAt: Date.now(),
          });
        }
        return;
      }

      // PLAYER_EVENT format (VidAPI-style embeds)
      if (data.type === 'PLAYER_EVENT' || data.event === 'playing') {
        const payload = data.data || data;
        const progress = payload.player_progress || payload.currentTime || 0;
        const duration = payload.player_duration || payload.duration || 0;

        if (progress > 0) {
          saveWatchProgress({
            id: media.id,
            title: media.title,
            type: media.type,
            posterUrl: media.posterUrl,
            seasonNumber: season,
            episodeNumber: episode,
            progress,
            duration,
            // A finished episode is marked watched even if the embed failed
            // to report a usable duration.
            completed: payload.player_status === 'completed',
            updatedAt: Date.now(),
          });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [media, season, episode]);

  // Stable embed URL — only changes on provider/show/season/episode switch.
  // Supports async providers (e.g. Peachify needs a TMDB lookup).
  // Resume is read fresh from storage (keyed per-episode) at URL-build time,
  // NOT from a component state ref — otherwise switching to a NEW episode
  // would inherit the previous episode's timestamp and open near the end.
  const iframeKey = `${providerId}|${media.id}|${season}|${episode}`;
  const [embedUrl, setEmbedUrl] = useState<string>('');
  useEffect(() => {
    let cancelled = false;
    const saved = getWatchProgress(media.id, season, episode);
    const result = getProvider(providerId).getEmbedUrl({
      id: media.imdbId || media.tmdbId || media.id,
      type: media.type,
      season,
      episode,
      resumeAt: saved && saved.progress > 0 ? saved.progress : 0,
      autoplay: false,
    });
    if (result instanceof Promise) {
      result.then((url) => { if (!cancelled) setEmbedUrl(url); });
    } else {
      setEmbedUrl(result);
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, media.imdbId, media.tmdbId, media.id, media.type, season, episode]);

  // Hide the loading overlay if the embed never fires onLoad.
  useEffect(() => {
    if (!isIframeLoaded) {
      const t = setTimeout(() => setIsIframeLoaded(true), IFRAME_LOAD_TIMEOUT);
      return () => clearTimeout(t);
    }
  }, [isIframeLoaded, iframeKey]);

  return (
    <div className="w-full bg-slate-900 rounded-2xl border border-slate-800 p-3 sm:p-4 shadow-2xl">
      {/* Media info */}
      <div className="flex items-center gap-3 mb-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white line-clamp-1">
            {media.title}
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-slate-400">
              {media.type === 'tv' ? 'TV Series' : 'Movie'}
            </span>
            {media.year && <span className="text-xs text-slate-500">• {media.year}</span>}
            {media.rating && (
              <span className="text-xs text-amber-400 font-semibold flex items-center gap-1">
                <Star className="w-3 h-3 fill-current" />
                {media.rating}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Server switcher — compact cycle + dropdown instead of a crowded row. */}
      <div className="relative flex items-center gap-1.5 mb-3" ref={menuRef}>
        <button
          onClick={() => cycleServer(-1)}
          aria-label="Previous server"
          className="w-10 h-11 shrink-0 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 hover:text-white hover:border-slate-600 flex items-center justify-center cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          onClick={() => { autoFallbackCountRef.current = 0; setMenuOpen((o) => !o); }}
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          className="flex-1 flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 hover:text-white hover:border-slate-600 font-bold text-sm cursor-pointer"
        >
          <span>{currentServer.label}</span>
          <span className="text-xs text-cyan-400 font-medium">{PROVIDER_NAMES[currentServer.provider]}</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
        </button>

        <button
          onClick={() => cycleServer(1)}
          aria-label="Next server"
          className="w-10 h-11 shrink-0 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 hover:text-white hover:border-slate-600 flex items-center justify-center cursor-pointer"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {menuOpen && (
          <div
            role="listbox"
            aria-label="Choose video server"
            className="absolute left-0 right-0 top-full z-30 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5"
          >
            {SERVER_BUTTONS.map((btn) => {
              const isActive = providerId === btn.provider;
              return (
                <button
                  key={btn.provider}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    autoFallbackCountRef.current = 0;
                    handleProviderChange(btn.provider);
                    setMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold text-left cursor-pointer ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span>{btn.label}</span>
                  <span className="text-xs text-slate-500">{PROVIDER_NAMES[btn.provider]}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Iframe embed player */}
      <div className="relative w-full aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
        {hasError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/95 z-20">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mb-3 border border-rose-500/20">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Video unavailable</h3>
            <p className="text-xs text-slate-400 max-w-sm mb-4">Could not load this video.</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  // Skip to the next server, putting known-good servers first.
                  const fallbackOrder = getProviderFallbackOrder();
                  const current = fallbackOrder.indexOf(providerId);
                  handleProviderChange(fallbackOrder[(current + 1) % fallbackOrder.length]);
                }}
                className="px-5 py-2.5 bg-cyan-500 text-slate-950 rounded-xl font-bold text-sm cursor-pointer"
              >
                Try other server
              </button>
              <button
                onClick={() => setHasError(false)}
                className="px-5 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-bold text-sm cursor-pointer"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          /* Native Embed iframe */
          <>
            {!isIframeLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950 z-10">
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>Loading {getProvider(providerId).name}...</span>
                </div>
              </div>
            )}

            <iframe
              ref={iframeRef}
              key={iframeKey}
              src={embedUrl}
              className="w-full h-full border-0"
              referrerPolicy="origin"
              // Not sandboxed — providers detect sandbox and refuse to play.
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              onLoad={() => {
                setIsIframeLoaded(true);
                // Remember the server that worked for this title.
                rememberProvider(media.id, providerId);
                setPreferredProvider(providerId);
              }}
              onError={() => {
                // Server replied with an error — skip to the next server
                // instead of waiting for a manual click.
                const fallbackOrder = getProviderFallbackOrder();
                if (fallbackOrder.length > 1) {
                  const current = fallbackOrder.indexOf(providerId);
                  const next = fallbackOrder[(current + 1) % fallbackOrder.length];
                  if (next !== providerId && autoFallbackCountRef.current < fallbackOrder.length) {
                    autoFallbackCountRef.current += 1;
                    handleProviderChange(next);
                    return;
                  }
                }
                setHasError(true);
              }}
            />
          </>
        )}
      </div>

    </div>
  );
};
