import { useState, useRef, useEffect } from 'react';
import type { FC } from 'react';
import { Settings, Trash2, X, Server, Globe, ChevronUp, ChevronDown } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { clearWatchHistory, removeShowDefaultProvider } from '../utils/settings';
import { getMovieGenres } from '../services/rows';
import type { Genre } from '../services/rows';
import { GENRE_ROWS_MAX } from '../constants';
import { PROVIDERS } from '../providers';
import type { ProviderId } from '../types';

export const SettingsMenu: FC = () => {
  const [open, setOpen] = useState<boolean>(false);
  const ref = useRef<HTMLDivElement>(null);
  const [settings, update] = useSettings();
  const [genres, setGenres] = useState<Genre[] | null>(null);

  useEffect(() => {
    if (!open || genres !== null) return;
    let cancelled = false;
    getMovieGenres().then((list) => {
      if (!cancelled && list.length > 0) setGenres(list);
    });
    return () => {
      cancelled = true;
    };
  }, [open, genres]);

  const toggleGenreRow = (id: number, checked: boolean) => {
    const next = checked
      ? [...settings.genreRows, id].slice(0, GENRE_ROWS_MAX)
      : settings.genreRows.filter((g) => g !== id);
    update({ genreRows: next });
  };

  const togglePreferred = (id: ProviderId, enabled: boolean) => {
    update({
      preferredProviders: enabled
        ? [...settings.preferredProviders, id]
        : settings.preferredProviders.filter((pid) => pid !== id),
    });
  };

  const movePreferred = (id: ProviderId, dir: -1 | 1) => {
    const list = settings.preferredProviders;
    const from = list.indexOf(id);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= list.length) return;
    const next = [...list];
    [next[from], next[to]] = [next[to], next[from]];
    update({ preferredProviders: next });
  };

  const availableProviders = (Object.keys(PROVIDERS) as ProviderId[])
    .filter((id) => !settings.preferredProviders.includes(id));

  const showPins = Object.entries(settings.showDefaultProviders)
    .sort(([a, pinA], [b, pinB]) => (pinA.title || a).localeCompare(pinB.title || b));

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Settings"
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-10 h-10 rounded-xl bg-slate-800 border-2 border-slate-700 text-slate-200 hover:border-cyan-500 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
      >
        <Settings className="w-5 h-5" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Settings"
          className="absolute right-0 top-full mt-2 w-72 max-h-[80vh] flex flex-col bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50"
        >
          <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
            <h3 className="text-sm font-bold text-white">Settings</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close settings"
              className="text-slate-500 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-4 pb-2 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300 font-medium">Theme</span>
              <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => update({ theme: 'dark' })}
                  aria-pressed={settings.theme === 'dark'}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    settings.theme === 'dark'
                      ? 'bg-cyan-500 text-slate-900'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Dark
                </button>
                <button
                  type="button"
                  onClick={() => update({ theme: 'light' })}
                  aria-pressed={settings.theme === 'light'}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    settings.theme === 'light'
                      ? 'bg-cyan-500 text-slate-900'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Light
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-y-auto px-4 pb-4">
          <label className="block mb-4">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Default server</span>
            <p className="text-[11px] text-slate-500 mt-1 mb-2">
              Used for a title until you pick another server while watching it.
            </p>
            <select
              value={settings.defaultProvider}
              onChange={(e) => update({ defaultProvider: e.target.value as ProviderId })}
              className="w-full bg-slate-800 border border-slate-700 focus:border-cyan-500 text-slate-200 rounded-lg px-3 py-2 text-sm cursor-pointer focus:outline-none"
            >
              {Object.entries(PROVIDERS).map(([id, p]) => (
                <option key={id} value={id}>{p.name}</option>
              ))}
            </select>
          </label>

          <div className="mb-4">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Server order</span>
            <p className="text-[11px] text-slate-500 mt-1 mb-2">
              Fallback order when a server fails. The first one is tried first.
            </p>

            <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
              {settings.preferredProviders.map((id, index) => (
                <div
                  key={id}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60"
                >
                  <span className="w-4 text-[10px] font-mono text-slate-500 shrink-0">{index + 1}</span>
                  <span className="flex-1 min-w-0 text-xs text-slate-300 truncate">{PROVIDERS[id].name}</span>
                  <button
                    type="button"
                    onClick={() => movePreferred(id, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${PROVIDERS[id].name} up`}
                    className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-white disabled:opacity-25 disabled:cursor-default cursor-pointer shrink-0"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => movePreferred(id, 1)}
                    disabled={index === settings.preferredProviders.length - 1}
                    aria-label={`Move ${PROVIDERS[id].name} down`}
                    className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-white disabled:opacity-25 disabled:cursor-default cursor-pointer shrink-0"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePreferred(id, false)}
                    aria-label={`Remove ${PROVIDERS[id].name} from the order`}
                    className="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:text-rose-400 cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {availableProviders.length > 0 && (
              <select
                value=""
                aria-label="Add a server to the order"
                onChange={(e) => {
                  if (e.target.value) togglePreferred(e.target.value as ProviderId, true);
                }}
                className="mt-2 w-full bg-slate-800 border border-slate-700 focus:border-cyan-500 text-slate-300 rounded-lg px-3 py-1.5 text-xs cursor-pointer focus:outline-none"
              >
                <option value="">Add server…</option>
                {availableProviders.map((id) => (
                  <option key={id} value={id}>{PROVIDERS[id].name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide">
                Per-show servers
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mb-2">
              Shows you pinned a server for while watching. Reset one to follow the default again.
            </p>
            {showPins.length === 0 ? (
              <p className="text-[11px] text-slate-500 py-1">
                No pinned shows yet. Use the pin button in the player.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {showPins.map(([id, pin]) => (
                  <div
                    key={id}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/60"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Server className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="text-xs text-slate-300 truncate" title={pin.title || id}>
                        {pin.title || id}
                      </span>
                      <span className="text-[10px] text-slate-500 shrink-0">
                        → {PROVIDERS[pin.provider].name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeShowDefaultProvider(id)}
                      className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 cursor-pointer shrink-0"
                    >
                      Reset
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-center justify-between mb-1 cursor-pointer">
            <span className="text-sm text-slate-300 font-medium">Autoplay next episode</span>
            <input
              type="checkbox"
              checked={settings.autoplayNext}
              onChange={(e) => update({ autoplayNext: e.target.checked })}
              className="w-5 h-5 accent-cyan-500 cursor-pointer"
            />
          </label>
          <p className="text-[11px] text-slate-500 mb-3">
            Availability depends on the selected server.
          </p>

          <label className="flex items-center justify-between mb-1 cursor-pointer">
            <span className="text-sm text-slate-300 font-medium">English-only trending</span>
            <input
              type="checkbox"
              checked={settings.englishOnly}
              onChange={(e) => update({ englishOnly: e.target.checked })}
              className="w-5 h-5 accent-cyan-500 cursor-pointer"
            />
          </label>
          <p className="text-[11px] text-slate-500 mb-3">
            Hides non-English originals from home recommendations.
          </p>

          <div className="mb-4">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Genre rows</span>
            <p className="text-[11px] text-slate-500 mt-1 mb-2">
              Pick up to {GENRE_ROWS_MAX} genres to show on the home page.
            </p>
            {genres === null ? (
              <p className="text-xs text-slate-500 py-1">Loading genres…</p>
            ) : (
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 max-h-36 overflow-y-auto pr-1">
                {genres.map((g) => {
                  const checked = settings.genreRows.includes(g.id);
                  const disabled = !checked && settings.genreRows.length >= GENRE_ROWS_MAX;
                  return (
                    <label
                      key={g.id}
                      className={`flex items-center gap-2 text-sm rounded px-1 py-0.5 ${
                        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={(e) => toggleGenreRow(g.id, e.target.checked)}
                        className="w-4 h-4 shrink-0 accent-cyan-500 cursor-pointer"
                      />
                      <span className="text-slate-300 line-clamp-1">{g.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <label className="block mb-4">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Accent color</span>
            <input
              type="color"
              value={settings.accentColor}
              onChange={(e) => update({ accentColor: e.target.value })}
              className="mt-1 w-full h-10 bg-slate-800 border border-slate-700 rounded-lg cursor-pointer"
            />
          </label>

          <button
            type="button"
            onClick={() => { clearWatchHistory(); setOpen(false); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 hover:bg-rose-500/20 font-bold text-sm rounded-xl transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" /> Clear watch history
          </button>
          </div>
        </div>
      )}
    </div>
  );
};
