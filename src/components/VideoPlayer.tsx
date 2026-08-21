import { useState, useEffect, useRef, useCallback } from 'react';
import type { FC } from 'react';
import type { MediaItem } from '../types';
import { getProvider } from '../providers';
import {
  setPreferredProvider,
  getProviderFallbackOrder,
  rememberProvider,
  saveWatchProgress,
  getWatchProgress,
  recordServerSuccess,
  recordServerFailure,
} from '../utils/storage';
import { useSettings } from '../hooks/useSettings';
import { getSettings } from '../utils/settings';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import type { ProviderId } from '../types';
import { IFRAME_LOAD_TIMEOUT } from '../constants';
import ServerStatusDot from './ServerStatusDot';
import EndOfContentOverlay from './EndOfContentOverlay';

interface VideoPlayerProps {
  media: MediaItem;
  season?: number;
  episode?: number;
  onAutoNext?: () => void;
}

const SERVER_BUTTONS: readonly { label: string; provider: ProviderId }[] = [
  { label: 'Server 1', provider: 'vidrock' },
  { label: 'Server 2', provider: 'vidapi' },
  { label: 'Server 3', provider: 'videasy' },
  { label: 'Server 4', provider: 'peachify' },
  { label: 'Server 5', provider: 'vidsrc' },
  { label: 'Server 6', provider: 'vidcore' },
  { label: 'Server 7', provider: 'vidzee' },
];

const PROVIDER_NAMES: Record<ProviderId, string> = {
  videasy: 'Videasy',
  vidrock: 'VidRock',
  vidapi: 'VidAPI',
  peachify: 'Peachify',
  vidsrc: 'VidSrc',
  vidcore: 'VidCore',
  vidzee: 'VidZee',
};

export const VideoPlayer: FC<VideoPlayerProps> = ({ media, season, episode, onAutoNext }) => {
  const [settings] = useSettings();
  const [providerId, setProviderId] = useState<ProviderId>(() => getSettings().defaultProvider);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isIframeLoaded, setIsIframeLoaded] = useState<boolean>(false);
  const [ended, setEnded] = useState<boolean>(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const manualOverrideRef = useRef(false);
  const autoFallbackCountRef = useRef(0);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const currentServer =
    SERVER_BUTTONS.find((b) => b.provider === providerId) ?? SERVER_BUTTONS[0];

  useEffect(() => {
    setHasError(false);
    setIsIframeLoaded(false);
    setEnded(false);
    autoFallbackCountRef.current = 0;
    if (!manualOverrideRef.current) {
      setProviderId(getSettings().defaultProvider);
    }
  }, [media.id, media.tmdbId, season, episode]);

  const handleProviderChange = useCallback((newProvider: ProviderId) => {
    manualOverrideRef.current = true;
    setProviderId(newProvider);
    setPreferredProvider(newProvider);
    setHasError(false);
    setIsIframeLoaded(false);
    setEnded(false);
  }, []);

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

  const cycleServer = (dir: 1 | -1) => {
    const idx = SERVER_BUTTONS.findIndex((b) => b.provider === providerId);
    const next = SERVER_BUTTONS[(idx + dir + SERVER_BUTTONS.length) % SERVER_BUTTONS.length];
    autoFallbackCountRef.current = 0;
    handleProviderChange(next.provider);
    setMenuOpen(false);
  };

  const handleMessage = useCallback((event: MessageEvent) => {
    let data = event.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { return; }
    }
    if (!data || typeof data !== 'object') return;

    const payload = data as Record<string, unknown>;

    if (typeof payload.timestamp === 'number' || typeof payload.progress === 'number') {
      const progress = (payload.timestamp as number) || 0;
      const duration = (payload.duration as number) || 0;
      if (progress > 0) {
        saveWatchProgress({
          id: media.id,
          title: media.title,
          type: media.type,
          posterUrl: media.posterUrl,
          seasonNumber: payload.season ? Number(payload.season) : season,
          episodeNumber: payload.episode ? Number(payload.episode) : episode,
          progress,
          duration,
          completed: false,
          updatedAt: Date.now(),
        });
      }
      return;
    }

    if (data.type === 'PLAYER_EVENT' || payload.event === 'playing') {
      const pl = (payload.data as Record<string, unknown>) || payload;
      const progress = (pl.player_progress as number) || (pl.currentTime as number) || 0;
      const duration = (pl.player_duration as number) || (pl.duration as number) || 0;

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
          completed: pl.player_status === 'completed',
          updatedAt: Date.now(),
        });
      }

      if ((pl.player_status as string) === 'completed' || payload.ended) {
        setEnded(true);
        if (settings.autoplayNext && onAutoNext) {
          setTimeout(() => onAutoNext(), 1500);
        }
      }
      return;
    }

    if (
      payload.error === 'Content Not Found' ||
      payload.status === 404 ||
      (typeof payload.message === 'string' && payload.message.includes('Content Not Found'))
    ) {
      recordServerFailure(providerId);
      const fallbackOrder = getProviderFallbackOrder();
      if (autoFallbackCountRef.current < fallbackOrder.length) {
        autoFallbackCountRef.current += 1;
        const current = fallbackOrder.indexOf(providerId);
        const next = fallbackOrder[(current + 1) % fallbackOrder.length];
        if (next !== providerId) {
          handleProviderChange(next);
          return;
        }
      }
      setHasError(true);
    }
  }, [media, season, episode, providerId, handleProviderChange, settings.autoplayNext, onAutoNext]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

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
  }, [providerId, media.imdbId, media.tmdbId, media.id, media.type, season, episode]);

  useEffect(() => {
    if (!isIframeLoaded) {
      const t = setTimeout(() => setIsIframeLoaded(true), IFRAME_LOAD_TIMEOUT);
      return () => clearTimeout(t);
    }
  }, [isIframeLoaded, iframeKey]);

  const handleReplay = useCallback(() => {
    setEnded(false);
    setIsIframeLoaded(false);
  }, []);

  return (
    <div className="w-full bg-slate-900 rounded-2xl border border-slate-800 p-3 sm:p-4 shadow-2xl">
      <div className="flex items-center gap-3 mb-3">
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

      <div className="relative flex items-center gap-1.5 mb-3" ref={menuRef}>
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
          type="button"
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
                  type="button"
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
                  <span className="flex items-center gap-2">
                    <ServerStatusDot provider={btn.provider} />
                    {btn.label}
                  </span>
                  <span className="text-xs text-slate-500">{PROVIDER_NAMES[btn.provider]}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

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
                type="button"
                onClick={() => {
                  const fallbackOrder = getProviderFallbackOrder();
                  const current = fallbackOrder.indexOf(providerId);
                  handleProviderChange(fallbackOrder[(current + 1) % fallbackOrder.length]);
                }}
                className="px-5 py-2.5 bg-cyan-500 text-slate-950 rounded-xl font-bold text-sm cursor-pointer"
              >
                Try other server
              </button>
              <button
                type="button"
                onClick={() => setHasError(false)}
                className="px-5 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-bold text-sm cursor-pointer"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <>
            {!isIframeLoaded && (
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
                nextSeason={season}
                nextEpisode={episode}
                onReplay={handleReplay}
                onNext={onAutoNext}
              />
            )}

            <iframe
              ref={iframeRef}
              key={iframeKey}
              src={embedUrl}
              className="w-full h-full border-0"
              referrerPolicy="origin"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              onLoad={() => {
                setIsIframeLoaded(true);
                rememberProvider(media.id, providerId);
                setPreferredProvider(providerId);
                recordServerSuccess(providerId);
              }}
              onError={() => {
                recordServerFailure(providerId);
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
