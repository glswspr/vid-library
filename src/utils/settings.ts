import type { ProviderId } from '../types';
import { GENRE_ROWS_MAX } from '../constants';
import { clearWatchHistory as clearWatchHistoryInStorage } from './storage';
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
  /** Explicit per-show server pins keyed by media id. Wins over everything else. */
  showDefaultProviders: Record<string, ShowServerPin>;
}

export interface ShowServerPin {
  provider: ProviderId;
  /** Show name, stored so Settings can list pins without a network lookup. */
  title?: string;
}

const SETTINGS_KEY = 'vid_library_settings';
/** Order used before 111Movies and StreamX became the first two servers. */
const LEGACY_PREFERRED_ORDER: ProviderId[] = ['vidrock', 'vidapi', 'videasy', 'peachify', 'vidsrc', 'vidcore', 'vidzee', 'mapple', 'm111', 'streamx'];

const DEFAULTS: AppSettings = {
  defaultProvider: 'm111',
  autoplayNext: true,
  accentColor: '#06b6d4',
  englishOnly: true,
  genreRows: [28, 35, 878], // Action, Comedy, Science Fiction
  preferredProviders: ['m111', 'streamx', 'vidrock', 'vidapi', 'videasy', 'peachify', 'vidsrc', 'vidcore', 'vidzee', 'mapple'],
  theme: 'dark',
  showDefaultProviders: {},
};

function isValidProvider(value: unknown): ProviderId | null {
  if (typeof value !== 'string') return null;
  if (['vidrock', 'vidapi', 'videasy', 'peachify', 'vidsrc', 'vidcore', 'vidzee', 'mapple', 'm111', 'streamx'].includes(value)) {
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

function sanitizeShowDefaultProviders(value: unknown): Record<string, ShowServerPin> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  const out: Record<string, ShowServerPin> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (!key) continue;
    // Older builds stored a bare provider id; accept both shapes.
    const provider = typeof val === 'string'
      ? isValidProvider(val)
      : isValidProvider((val as ShowServerPin | null)?.provider);
    if (!provider) continue;
    const title = typeof val === 'object' && val !== null
      ? (val as ShowServerPin).title
      : undefined;
    out[key] = typeof title === 'string' && title ? { provider, title } : { provider };
  }
  return out;
}

function isValidTheme(value: unknown): 'dark' | 'light' | null {
  return value === 'light' || value === 'dark' ? value : null;
}

/** Accent colors are injected into CSS, so only accept a plain hex value. */
function sanitizeAccentColor(value: unknown): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
    ? value
    : DEFAULTS.accentColor;
}

/**
 * Detect a stored order the user never edited: the previous default array,
 * in the previous order. Only then is it replaced by the new default, so a
 * customised order is never overwritten.
 */
function isLegacyDefaultOrder(stored: ProviderId[]): boolean {
  return stored.length === LEGACY_PREFERRED_ORDER.length &&
    stored.every((id, index) => id === LEGACY_PREFERRED_ORDER[index]);
}

function readSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const storedPreferred = Array.isArray(parsed.preferredProviders)
      ? parsed.preferredProviders.filter(isValidProvider)
      : DEFAULTS.preferredProviders;
    const untouchedOrder = isLegacyDefaultOrder(storedPreferred);
    const storedDefault = isValidProvider(parsed.defaultProvider);
    return {
      // A user who never changed either value follows the new server 1.
      defaultProvider: untouchedOrder && storedDefault === 'vidrock'
        ? DEFAULTS.defaultProvider
        : storedDefault ?? DEFAULTS.defaultProvider,
      autoplayNext: typeof parsed.autoplayNext === 'boolean' ? parsed.autoplayNext : DEFAULTS.autoplayNext,
      accentColor: sanitizeAccentColor(parsed.accentColor),
      englishOnly: typeof parsed.englishOnly === 'boolean' ? parsed.englishOnly : DEFAULTS.englishOnly,
      genreRows: sanitizeGenreRows(parsed.genreRows),
      preferredProviders: untouchedOrder ? DEFAULTS.preferredProviders : storedPreferred,
      theme: isValidTheme(parsed.theme) ?? DEFAULTS.theme,
      showDefaultProviders: sanitizeShowDefaultProviders(parsed.showDefaultProviders),
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

/**
 * Watch history lives in `storage.ts` (in-memory cache + batched writes).
 * This must delegate there — dropping the raw localStorage key on its own
 * left the in-memory cache intact, so entries were never actually cleared and
 * the next progress write re-persisted the whole "cleared" list.
 */
export function clearWatchHistory(): void {
  clearWatchHistoryInStorage();
}

/** Resolve the server a title should start on.
 *  Priority: per-show pin > global default.
 *  The remembered-per-title value is not consulted here: it is the automatic
 *  "last server that worked" signal, and letting it win made the Default
 *  server setting appear to do nothing for any title already played. It is
 *  still used to order fallback candidates (see `getProviderFallbackOrder`). */
export function resolveDefaultProvider(mediaId: string): ProviderId {
  const settings = readSettings();
  const pinned = settings.showDefaultProviders[mediaId]?.provider;
  if (pinned) return pinned;
  return settings.defaultProvider;
}

/** Pin a server for one show. `title` is shown in Settings. */
export function setShowDefaultProvider(
  mediaId: string,
  provider: ProviderId,
  title?: string,
): AppSettings {
  const next = readSettings();
  next.showDefaultProviders = {
    ...next.showDefaultProviders,
    [mediaId]: { provider, ...(title ? { title } : {}) },
  };
  writeSettings(next);
  return next;
}

/** Remove a per-show pin, falling back to the remembered/global server. */
export function removeShowDefaultProvider(mediaId: string): AppSettings {
  const next = readSettings();
  if (!next.showDefaultProviders[mediaId]) return next;
  const rest = { ...next.showDefaultProviders };
  delete rest[mediaId];
  next.showDefaultProviders = rest;
  writeSettings(next);
  return next;
}

/** Read the pinned server for a media id, or null if none is set. */
export function getShowDefaultProvider(mediaId: string): ProviderId | null {
  return readSettings().showDefaultProviders[mediaId]?.provider ?? null;
}