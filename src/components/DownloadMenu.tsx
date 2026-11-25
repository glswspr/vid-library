import { useCallback, useEffect, useRef, useState } from 'react';
import type { FC } from 'react';
import { Download, Loader2, X } from 'lucide-react';
import type { MediaItem, MediaType } from '../types';
import { fetchDownloads, type DownloadSource } from '../services/downloads';
import { resolveTmdbFromImdb } from '../services/metadata';

interface DownloadMenuProps {
  media: MediaItem;
  type: MediaType;
  season?: number;
  episode?: number;
}

/** Group sources by quality so each resolution appears once, with its mirrors. */
function groupByQuality(sources: DownloadSource[]): Array<[string, DownloadSource[]]> {
  const groups = new Map<string, DownloadSource[]>();
  for (const source of sources) {
    const list = groups.get(source.quality) || [];
    list.push(source);
    groups.set(source.quality, list);
  }
  return [...groups.entries()].sort(
    (a, b) => (parseInt(b[0], 10) || 0) - (parseInt(a[0], 10) || 0),
  );
}

export const DownloadMenu: FC<DownloadMenuProps> = ({ media, type, season, episode }) => {
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState<DownloadSource[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Anchored in viewport coordinates: the button sits at the far right of a
  // card that is itself inside a padded column, so a `right-0` panel ran off
  // the left edge of a phone screen.
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number } | null>(null);

  const placePanel = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(352, window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    setAnchor({ top: rect.bottom + 6, left, width });
  }, []);

  useEffect(() => {
    if (!open) {
      setAnchor(null);
      return;
    }
    placePanel();
    window.addEventListener('resize', placePanel);
    window.addEventListener('scroll', placePanel, true);
    return () => {
      window.removeEventListener('resize', placePanel);
      window.removeEventListener('scroll', placePanel, true);
    };
  }, [open, placePanel]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent | TouchEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || sources !== null) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // The worker resolves by TMDB id, so an IMDb-only title has to be
        // translated first.
        let tmdbId = media.tmdbId || (media.id.startsWith('tt') ? null : media.id);
        if (!tmdbId && media.imdbId) {
          tmdbId = (await resolveTmdbFromImdb(media.imdbId, type))?.id ?? null;
        }
        if (!tmdbId) {
          if (!controller.signal.aborted) {
            setError('No TMDB match for this title.');
            setSources([]);
          }
          return;
        }

        const list = await fetchDownloads({
          tmdbId,
          type,
          season,
          episode,
          title: media.title,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setSources(list);
      } catch (e) {
        if (controller.signal.aborted || (e instanceof DOMException && e.name === 'AbortError')) return;
        setError('Could not reach the download service.');
        setSources([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [open, sources, media.id, media.imdbId, media.tmdbId, media.title, type, season, episode]);

  // A new episode or title is a different file list.
  useEffect(() => {
    setSources(null);
    setError(null);
    setOpen(false);
  }, [media.id, season, episode]);

  const groups = sources ? groupByQuality(sources) : [];

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Download"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`w-10 h-11 shrink-0 rounded-xl border flex items-center justify-center cursor-pointer transition-colors ${
          open
            ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300'
            : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:border-slate-600'
        }`}
      >
        <Download className="w-5 h-5" />
      </button>

      {open && anchor && (
        <div
          role="menu"
          style={{ position: 'fixed', top: anchor.top, left: anchor.left, width: anchor.width }}
          className="z-[60] rounded-xl bg-slate-900 border border-slate-700 shadow-2xl shadow-black/60 overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/60">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Download
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close download menu"
              className="text-slate-500 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading && (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              Finding files…
            </div>
          )}

          {!loading && error && (
            <p className="px-3 py-3 text-sm text-rose-300">{error}</p>
          )}

          {!loading && !error && sources && sources.length === 0 && (
            <p className="px-3 py-3 text-sm text-slate-400">
              No downloadable file for this title right now.
            </p>
          )}

          {!loading && groups.length > 0 && (
            <div className="max-h-64 overflow-y-auto">
              {groups.map(([quality, list]) => (
                <div key={quality} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="w-12 shrink-0 text-xs font-bold text-cyan-300">{quality}</span>
                  {list.map((source) => (
                    <a
                      key={`${source.provider}-${quality}-${source.url}`}
                      href={source.url}
                      download={source.filename}
                      className="flex-1 min-w-0 flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 bg-slate-900/60 border border-slate-700/60 hover:border-cyan-500/70 hover:bg-slate-900 transition-colors"
                    >
                      <span className="min-w-0">
                        <span className="block text-[11px] font-semibold text-slate-200 truncate">
                          {source.provider} · {source.format.toUpperCase()}
                        </span>
                        <span className="block text-[10px] text-slate-500">
                          {source.size || 'size unknown'}
                        </span>
                      </span>
                      <Download className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </a>
                  ))}
                </div>
              ))}
            </div>
          )}

          {!loading && groups.length > 0 && (
            <p className="px-3 py-2 text-[10px] text-slate-500 border-t border-slate-700/60">
              Links expire, so start the download soon. If a file fails, try another server.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
