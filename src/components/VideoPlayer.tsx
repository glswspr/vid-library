import { useState, useEffect, useRef, useCallback } from 'react';
import type { FC } from 'react';
import type { MediaItem } from '../types';
import { getProvider } from '../providers';
import {
  getProviderFallbackOrder,
  rememberProvider,
  saveWatchProgress,
  getWatchProgress,
  recordServerSuccess,
  recordServerFailure,
} from '../utils/storage';
import { useSettings } from '../hooks/useSettings';
import {
  resolveDefaultProvider,
  setShowDefaultProvider,
  removeShowDefaultProvider,
} from '../utils/settings';
import { AlertTriangle, RefreshCw, ChevronLeft, ChevronRight, ChevronDown, Check, Star, Maximize, Minimize, Crosshair, Pin } from 'lucide-react';
import type { ProviderId } from '../types';
import { IFRAME_LOAD_TIMEOUT } from '../constants';
import { scrollToElement } from '../utils/scroll';
import EndOfContentOverlay from './EndOfContentOverlay';
import { DownloadMenu } from './DownloadMenu';

interface VideoPlayerProps {
  media: MediaItem;
  season?: number;
  episode?: number;
  /** True when a further episode exists, so the end card offers "Next episode". */
  hasNextEpisode?: boolean;
  onAutoNext?: () => void;
}

const PROVIDER_NAMES: Record<ProviderId, string> = {
  vidprime: 'VidPrime',
  vixsrc: 'VixSrc',
  vidnest: 'VidNest',
  vidlink: 'VidLink',
  vidsrc: 'VidSrc',
  mapple: 'Mapple',
  vidzee: 'VidZee',
  vidcore: 'VidCore',
  peachify: 'Peachify',
  vidapi: 'VidAPI',
  m111: '111Movies',
};

/** The player box is always 16:9; the sizing effect quotes it every resize. */
const IFRAME_ASPECT_RATIO = 16 / 9;

export const VideoPlayer: FC<VideoPlayerProps> = ({ media, season, episode, hasNextEpisode, onAutoNext }) => {
  const [settings] = useSettings();
  const [providerId, setProviderId] = useState<ProviderId>(() => resolveDefaultProvider(media.id));
  const [hasError, setHasError] = useState<boolean>(false);
  const [isIframeLoaded, setIsIframeLoaded] = useState<boolean>(false);
  const [ended, setEnded] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [reloadNonce, setReloadNonce] = useState<number>(0);
  // Derived from settings rather than mirrored in state: resetting a pin in
  // Settings must clear it here too, and `useSettings` re-reads on change.
  const pinned = Boolean(settings.showDefaultProviders[media.id]);

  const [containerWidth, setContainerWidth] = useState<string>('100%');
  const [containerHeight, setContainerHeight] = useState<string>('');

  useEffect(() => {
    const updateContainerSize = () => {
      const outerEl = document.querySelector('[data-video-player-outer]');
      const chromeEl = document.querySelector('[data-video-player-chrome]');
      if (!outerEl || !chromeEl) {
        const maxWidth = window.innerWidth - 96;
        const maxHeight = window.innerHeight - 96;
        let width: number;
        let height: number;
        if (maxWidth / maxHeight > IFRAME_ASPECT_RATIO) {
          height = maxHeight;
          width = height * IFRAME_ASPECT_RATIO;
        } else {
          width = maxWidth;
          height = width / IFRAME_ASPECT_RATIO;
        }
        setContainerWidth(`${Math.round(width)}px`);
        setContainerHeight(`${Math.round(height)}px`);
        return;
      }
      const outerRect = outerEl.getBoundingClientRect();
      const chromeRect = chromeEl.getBoundingClientRect();
      const navbarHeight = 64;
      const availableHeight = window.innerHeight - navbarHeight - outerRect.top + chromeRect.top;
      // Never wider than the card's own content box: `innerWidth - 48` ignored
      // the padding on narrow screens and pushed the frame past the card.
      const cardInnerWidth = outerRect.width - 24;
      const maxWidth = Math.max(200, Math.min(window.innerWidth - 48, cardInnerWidth));
      let width: number;
      let height: number;
      if (maxWidth / availableHeight > IFRAME_ASPECT_RATIO) {
        height = availableHeight;
        width = height * IFRAME_ASPECT_RATIO;
      } else {
        width = maxWidth;
        height = width / IFRAME_ASPECT_RATIO;
      }
      setContainerWidth(`${Math.round(width)}px`);
      setContainerHeight(`${Math.round(height)}px`);
    };
    updateContainerSize();
    window.addEventListener('resize', updateContainerSize);
    return () => window.removeEventListener('resize', updateContainerSize);
  }, []);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const serverMenuRef = useRef<HTMLDivElement>(null);
  const manualOverrideRef = useRef(false);
  const overrideForIdRef = useRef<string>(media.id);
  const autoFallbackCountRef = useRef(0);
  // The server arrows walk the user's order, so the label and the arrows can
  // never disagree with Settings.
  const serverOrder = getProviderFallbackOrder(settings.preferredProviders);
  const currentServerIndex = Math.max(0, serverOrder.indexOf(providerId));
  const currentServerLabel = `Server ${currentServerIndex + 1}`;
  const [serverMenuOpen, setServerMenuOpen] = useState(false);

  useEffect(() => {
    if (!serverMenuOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (serverMenuRef.current && !serverMenuRef.current.contains(e.target as Node)) {
        setServerMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setServerMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [serverMenuOpen]);

  useEffect(() => {
    setHasError(false);
    setIsIframeLoaded(false);
    setEnded(false);
    autoFallbackCountRef.current = 0;
    // A manual server choice belongs to one title. Moving to another title has
    // to start from that title's own default, or a per-show pin could never
    // take effect.
    if (overrideForIdRef.current !== media.id) {
      overrideForIdRef.current = media.id;
      manualOverrideRef.current = false;
    }
    if (!manualOverrideRef.current) {
      setProviderId(resolveDefaultProvider(media.id));
    }
  }, [media.id, media.tmdbId, season, episode]);

  const handleProviderChange = useCallback((newProvider: ProviderId, rememberForShow = true) => {
    manualOverrideRef.current = true;
    setProviderId(newProvider);
    // Keep an existing pin pointing at the server the user just chose.
    if (rememberForShow && pinned) {
      setShowDefaultProvider(media.id, newProvider, media.title);
    }
    setHasError(false);
    setIsIframeLoaded(false);
    setEnded(false);
  }, [media.id, media.title, pinned]);

  const togglePin = useCallback(() => {
    if (pinned) {
      removeShowDefaultProvider(media.id);
      return;
    }
    setShowDefaultProvider(media.id, providerId, media.title);
  }, [pinned, media.id, media.title, providerId]);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el || !document.fullscreenEnabled) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const handleScrollToVideo = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    scrollToElement(el);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'f' && e.key !== 'F') return;
      // Ctrl/Cmd/Alt+F are browser shortcuts (e.g. Ctrl+F = find).
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }
      // Don't hijack F while a modal / dropdown owns the screen.
      if (document.querySelector('[role="dialog"], [role="menu"]')) return;
      e.preventDefault();
      toggleFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleFullscreen]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const cycleServer = (dir: 1 | -1) => {
    const idx = serverOrder.indexOf(providerId);
    const next = serverOrder[(idx + dir + serverOrder.length) % serverOrder.length];
    autoFallbackCountRef.current = 0;
    handleProviderChange(next);
  };

  const handleMessage = useCallback((event: MessageEvent) => {
    // The embeds are third-party frames that also serve ads. Two guards keep
    // those frames from writing forged entries into watch history or forcing
    // provider switches:
    //  1. the message must originate from the player iframe itself, and
    //  2. the payload must match the documented PLAYER_EVENT protocol
    //     (PROVIDERS.md) or the provider "content not found" error signal.
    // The old code accepted any {timestamp|progress|duration|season|episode}
    // object from any origin, which was unauthenticated write access.
    const contentWindow = iframeRef.current?.contentWindow;
    if (!contentWindow || event.source !== contentWindow) return;

    let data = event.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { return; }
    }
    if (!data || typeof data !== 'object') return;

    const payload = data as Record<string, unknown>;
    // VidLink and VixSrc wrap their fields in `data`; anything that posts a
    // bare event object lands at the top level.
    const pl = (typeof payload.data === 'object' && payload.data !== null
      ? payload.data as Record<string, unknown>
      : payload);

    const num = (v: unknown): number | null =>
      typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;

    const rawProgress = num(pl.player_progress) ?? num(pl.currentTime) ?? num(pl.timestamp) ?? num(pl.progress);
    const rawDuration = num(pl.player_duration) ?? num(pl.duration);
    const status = typeof pl.player_status === 'string' ? pl.player_status : undefined;
    const eventName = typeof pl.event === 'string' ? pl.event : undefined;

    const isPlayerEvent = payload.type === 'PLAYER_EVENT' || eventName === 'playing';
    const isErrorSignal =
      payload.error === 'Content Not Found' ||
      payload.status === 404 ||
      (typeof payload.message === 'string' && payload.message.includes('Content Not Found'));
    if (!isPlayerEvent && !isErrorSignal && rawProgress === null) return;

    if (rawProgress !== null && rawProgress > 0) {
      saveWatchProgress({
        id: media.id,
        title: media.title,
        type: media.type,
        posterUrl: media.posterUrl,
        // Always attribute to the episode the user is watching, never to a
        // season/episode number supplied by the untrusted payload.
        seasonNumber: season,
        episodeNumber: episode,
        progress: rawProgress,
        duration: rawDuration ?? 0,
        completed: status === 'completed',
        updatedAt: Date.now(),
      });
    }

    if (status === 'completed' || eventName === 'ended' || payload.ended === true) {
      setEnded(true);
      // Navigation happens on this page, not inside the embed, so the
      // provider's "autoplay next" capability (false for every provider)
      // must not gate it — otherwise the setting could never work.
      if (settings.autoplayNext && onAutoNext) {
        setTimeout(() => onAutoNext(), 1500);
      }
      return;
    }

    if (isErrorSignal) {
      recordServerFailure(providerId);
      const fallbackOrder = getProviderFallbackOrder(settings.preferredProviders);
      if (autoFallbackCountRef.current < fallbackOrder.length) {
        autoFallbackCountRef.current += 1;
        const current = fallbackOrder.indexOf(providerId);
        const next = fallbackOrder[(current + 1) % fallbackOrder.length];
        if (next !== providerId) {
          // Automatic fallback is not a user choice — never persist it as
          // this show's default server.
          handleProviderChange(next, false);
          return;
        }
      }
      setHasError(true);
    }
  }, [media, season, episode, providerId, handleProviderChange, settings.autoplayNext, settings.preferredProviders, onAutoNext]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  const iframeKey = `${providerId}|${media.id}|${season}|${episode}|${reloadNonce}`;
  const [embedUrl, setEmbedUrl] = useState<string>('');

  /**
   * Build the embed URL. Every live provider takes a numeric TMDB id and
   * resolves an IMDB id itself, so the player passes the best id it has and
   * lets the provider finish the job.
   */
  useEffect(() => {
    let cancelled = false;
    const saved = getWatchProgress(media.id, season, episode);

    const result = getProvider(providerId).getEmbedUrl({
      id: media.tmdbId || media.imdbId || media.id,
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
  }, [providerId, media.id, media.imdbId, media.tmdbId, media.type, season, episode]);

  useEffect(() => {
    if (!isIframeLoaded) {
      const t = setTimeout(() => setIsIframeLoaded(true), IFRAME_LOAD_TIMEOUT);
      return () => clearTimeout(t);
    }
  }, [isIframeLoaded, iframeKey]);

  const handleReplay = useCallback(() => {
    setEnded(false);
    setIsIframeLoaded(false);
    // The embed owns playback state, so replay must remount the iframe —
    // clearing `ended` alone leaves the finished video on screen.
    setReloadNonce((n) => n + 1);
  }, []);

  return (
    <div data-video-player-outer className="w-full bg-slate-900 rounded-2xl border border-slate-800 p-3 sm:p-4 shadow-2xl">
      <div data-video-player-chrome className="flex items-center gap-3 mb-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white line-clamp-1">
            {media.title}
          </h2>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-slate-400">
              {media.type === 'tv' ? 'TV Series' : 'Movie'}
            </span>
            {media.year && <span className="text-xs text-slate-500">• {media.year}</span>}
            {media.duration && (
              <span className="text-xs text-slate-500">• {media.duration}</span>
            )}
            {media.rating && (
              <span className="text-xs text-amber-400 font-semibold flex items-center gap-1">
                <Star className="w-3 h-3 fill-current" />
                {media.rating}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mb-3 flex flex-col gap-1.5 sm:flex-row sm:items-center">
        <div className="relative flex items-center gap-1.5 sm:flex-1" ref={serverMenuRef}>
          <button
            type="button"
            onClick={() => cycleServer(-1)}
            aria-label="Previous server"
            className="w-10 h-11 shrink-0 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 hover:text-white hover:border-slate-600 flex items-center justify-center cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setServerMenuOpen((o) => !o)}
            aria-label="Choose server"
            aria-haspopup="menu"
            aria-expanded={serverMenuOpen}
            className="flex-1 min-w-0 flex items-center justify-center gap-2 h-11 px-3 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 hover:border-slate-600 font-bold text-sm cursor-pointer"
          >
            <span className="truncate">{currentServerLabel}</span>
            <span className="text-xs text-cyan-400 font-medium truncate hidden sm:inline">{PROVIDER_NAMES[providerId]}</span>
            <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${serverMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {serverMenuOpen && (
            <div
              role="menu"
              className="absolute left-0 right-0 top-full mt-1.5 z-30 max-h-72 overflow-y-auto rounded-xl bg-slate-800 border border-slate-700 shadow-2xl py-1"
            >
              {serverOrder.map((id, index) => (
                <button
                  key={id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={id === providerId}
                  onClick={() => {
                    if (id !== providerId) handleProviderChange(id);
                    setServerMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm cursor-pointer ${
                    id === providerId
                      ? 'bg-cyan-500/15 text-cyan-300'
                      : 'text-slate-200 hover:bg-slate-700/60'
                  }`}
                >
                  <span className="text-xs text-slate-500 w-14 shrink-0">Server {index + 1}</span>
                  <span className="font-semibold">{PROVIDER_NAMES[id]}</span>
                  {id === providerId && <Check className="w-4 h-4 ml-auto" />}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => cycleServer(1)}
            aria-label="Next server"
            className="w-10 h-11 shrink-0 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 hover:text-white hover:border-slate-600 flex items-center justify-center cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:shrink-0">
          <button
            type="button"
            onClick={togglePin}
            aria-label={pinned ? 'Unpin server for this show' : 'Always use this server for this show'}
            aria-pressed={pinned}
            title={pinned ? 'Unpin server for this show' : 'Always use this server for this show'}
            className={`w-10 h-11 shrink-0 rounded-xl border flex items-center justify-center cursor-pointer transition-colors ${
              pinned
                ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
            }`}
          >
            {pinned ? <Pin className="w-4 h-4 fill-current" /> : <Pin className="w-4 h-4" />}
          </button>

          <DownloadMenu media={media} type={media.type} season={season} episode={episode} />

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            className="w-10 h-11 shrink-0 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 hover:text-white hover:border-slate-600 flex items-center justify-center cursor-pointer"
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={handleScrollToVideo}
            aria-label="Scroll to video"
            className="w-10 h-11 shrink-0 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 hover:text-white hover:border-slate-600 flex items-center justify-center cursor-pointer"
          >
            <Crosshair className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div ref={containerRef} onDoubleClick={toggleFullscreen} data-video-player-inner className="relative bg-slate-950 rounded-xl overflow-hidden border border-slate-800 mx-auto" style={{ width: containerWidth, height: containerHeight }}>
        {hasError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/95 z-20">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mb-3 border border-rose-500/20">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Video unavailable</h3>
            <p className="text-xs text-slate-400 max-w-sm mb-4">Could not load this video.</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const fallbackOrder = getProviderFallbackOrder(settings.preferredProviders);
                  const current = fallbackOrder.indexOf(providerId);
                  handleProviderChange(fallbackOrder[(current + 1) % fallbackOrder.length]);
                }}
                className="px-5 py-2.5 bg-cyan-500 text-slate-950 rounded-xl font-bold text-sm cursor-pointer"
              >
                Try other server
              </button>
              <button
                type="button"
                onClick={() => {
                  setHasError(false);
                  setIsIframeLoaded(false);
                  setReloadNonce((n) => n + 1);
                }}
                className="px-5 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-bold text-sm cursor-pointer"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <>
            {(!isIframeLoaded || !embedUrl) && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950 z-10">
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>Loading {getProvider(providerId).name}...</span>
                </div>
              </div>
            )}

            {ended && (
              <EndOfContentOverlay
                mediaType={media.type}
                canGoNext={!!hasNextEpisode}
                onReplay={handleReplay}
                onNext={onAutoNext}
              />
            )}

            {/* No iframe until the URL exists: `src=""` makes the browser
                re-request the current page. The spinner covers the gap. */}
            {embedUrl && (
              <iframe
                ref={iframeRef}
                key={iframeKey}
                src={embedUrl}
                className="w-full h-full border-0"
                title={`${getProvider(providerId).name} player for ${media.title}`}
                referrerPolicy="origin"
                allow="autoplay; fullscreen; encrypted-media"
                allowFullScreen
                onLoad={() => {
                  setIsIframeLoaded(true);
                  rememberProvider(media.id, providerId);
                  recordServerSuccess(providerId);
                }}
                onError={() => {
                  recordServerFailure(providerId);
                  const fallbackOrder = getProviderFallbackOrder(settings.preferredProviders);
                  if (fallbackOrder.length > 1) {
                    const current = fallbackOrder.indexOf(providerId);
                    const next = fallbackOrder[(current + 1) % fallbackOrder.length];
                    if (next !== providerId && autoFallbackCountRef.current < fallbackOrder.length) {
                      autoFallbackCountRef.current += 1;
                      handleProviderChange(next, false);
                      return;
                    }
                  }
                  setHasError(true);
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};
