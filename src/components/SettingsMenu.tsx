import { useState, useRef, useEffect } from 'react';
import type { FC } from 'react';
import { Settings, Trash2, X } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { clearWatchHistory } from '../utils/settings';
import { PROVIDERS } from '../providers';
import type { ProviderId } from '../types';

export const SettingsMenu: FC = () => {
  const [open, setOpen] = useState<boolean>(false);
  const ref = useRef<HTMLDivElement>(null);
  const [settings, update] = useSettings();

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
          className="absolute right-0 top-full mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 z-50"
        >
          <div className="flex items-center justify-between mb-4">
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

          <label className="block mb-3">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Default server</span>
            <select
              value={settings.defaultProvider}
              onChange={(e) => update({ defaultProvider: e.target.value as ProviderId })}
              className="mt-1 w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm cursor-pointer focus:border-cyan-500"
            >
              {Object.entries(PROVIDERS).map(([id, p]) => (
                <option key={id} value={id}>{p.name}</option>
              ))}
            </select>
          </label>

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
      )}
    </div>
  );
};
