import type { ProviderId } from '../types';
import { GENRE_ROWS_MAX } from '../constants';

export interface AppSettings {
  defaultProvider: ProviderId;
  autoplayNext: boolean;
  accentColor: string;
  englishOnly: boolean;
  /** TMDB movie genre ids rendered as home-page rows. */
  genreRows: number[];
  /** Ordered list of preferred provider IDs (high to low priority). If empty, uses default fallback order. */
  preferredProviders: ProviderId[];
  /** UI color scheme. */
  theme: 'dark' | 'light';
}

const SETTINGS_KEY = 'vid_library_settings';
const DEFAULTS: AppSettings = {
  defaultProvider: 'vidrock',
  autoplayNext: true,
  accentColor: '#06b6d4',
  englishOnly: true,
  genreRows: [28, 35, 878], // Action, Comedy, Science Fiction
  preferredProviders: ['vidrock', 'vidapi', 'videasy', 'peachify', 'vidsrc', 'vidcore', 'vidzee'],
  theme: 'dark',
};

function isValidProvider(value: unknown): ProviderId | null {
  if (typeof value !== 'string') return null;
  if (['vidrock', 'vidapi', 'videasy', 'peachify', 'vidsrc', 'vidcore', 'vidzee'].includes(value)) {
    return value as ProviderId;
  }
  return null;
}

function sanitizeGenreRows(value: unknown): number[] {
  if (!Array.isArray(value)) return DEFAULTS.genreRows;
  return value
    .filter((id): id is number => typeof id === 'number' && Number.isFinite(id) && id > 0)
    .slice(0, GENRE_ROWS_MAX);
}

function isValidTheme(value: unknown): 'dark' | 'light' | null {
  return value === 'light' || value === 'dark' ? value : null;
}

function readSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      defaultProvider: isValidProvider(parsed.defaultProvider) ?? DEFAULTS.defaultProvider,
      autoplayNext: typeof parsed.autoplayNext === 'boolean' ? parsed.autoplayNext : DEFAULTS.autoplayNext,
      accentColor: typeof parsed.accentColor === 'string' ? parsed.accentColor : DEFAULTS.accentColor,
      englishOnly: typeof parsed.englishOnly === 'boolean' ? parsed.englishOnly : DEFAULTS.englishOnly,
      genreRows: sanitizeGenreRows(parsed.genreRows),
      preferredProviders: Array.isArray(parsed.preferredProviders) ? parsed.preferredProviders.filter(isValidProvider) : DEFAULTS.preferredProviders,
      theme: isValidTheme(parsed.theme) ?? DEFAULTS.theme,
    };
  } catch {
    return DEFAULTS;
  }
}

function writeSettings(value: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(value));
  } catch {
    // quota / serialization errors are non-fatal
  }
  window.dispatchEvent(new Event('settings-changed'));
}

export function getSettings(): AppSettings {
  return readSettings();
}

export function saveSettings(partial: Partial<AppSettings>): AppSettings {
  const next = { ...readSettings(), ...partial };
  writeSettings(next);
  return next;
}

export function clearWatchHistory(): void {
  try {
    localStorage.removeItem('vid_library_progress_v2');
    localStorage.removeItem('vid_library_provider_memory_v1');
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event('settings-changed'));
}