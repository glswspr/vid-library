import type { ProviderId } from '../types';
import { GENRE_ROWS_MAX } from '../constants';
import { isProviderId, PROVIDER_IDS } from '../providers/ids';
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

/**
 * Default orders used by earlier builds, when those servers still played or the
 * list was shorter. A stored order that still matches one of them was never
 * edited by the user, so the new default replaces it. Any other stored order is
 * kept, minus servers that no longer play. These ids are deliberately outside
 * `ProviderId`: the first two name servers that are gone, so they only exist to
 * recognise an old order.
 */
const LEGACY_PREFERRED_ORDERS: readonly (readonly string[])[] = [
  ['vidrock', 'vidapi', 'videasy', 'peachify', 'vidsrc', 'vidcore', 'vidzee', 'mapple', 'm111', 'streamx'],
  ['m111', 'streamx', 'vidrock', 'vidapi', 'videasy', 'peachify', 'vidsrc', 'vidcore', 'vidzee', 'mapple'],
  ['vidprime', 'vixsrc', 'vidnest', 'vidlink', 'peachify', 'vidcore'],
];

const DEFAULTS: AppSettings = {
  defaultProvider: 'vidprime',
  autoplayNext: true,
  accentColor: '#06b6d4',
  englishOnly: true,
  genreRows: [28, 35, 878], // Action, Comedy, Science Fiction
  preferredProviders: [...PROVIDER_IDS],
  theme: 'dark',
  showDefaultProviders: {},
};

function isValidProvider(value: unknown): ProviderId | null {
  return isProviderId(value) ? value : null;
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
    // A pin on a server that no longer exists would strand that show.
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
 * True when a stored order is byte-for-byte one of the old defaults, meaning
 * the user never touched it. Only then is it replaced, so a customised order
 * is never overwritten.
 */
function isLegacyDefaultOrder(stored: unknown[]): boolean {
  return LEGACY_PREFERRED_ORDERS.some((legacy) =>
    stored.length === legacy.length && stored.every((id, index) => id === legacy[index]),
  );
}

function readSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const stored = Array.isArray(parsed.preferredProviders) ? parsed.preferredProviders : null;
    const untouchedOrder = stored !== null && isLegacyDefaultOrder(stored);
    const storedPreferred = stored === null
      ? DEFAULTS.preferredProviders
      : stored.filter(isProviderId);

    // Keep the user's own order, minus servers that no longer play. An order
    // that loses every entry falls back to the defaults.
    const preferredProviders = untouchedOrder || storedPreferred.length === 0
      ? DEFAULTS.preferredProviders
      : storedPreferred;

    const storedDefault = isValidProvider(parsed.defaultProvider);
    // A default pointing at a server that no longer exists would leave the
    // player stuck on a frame that cannot load, so it resets to the first.
    const defaultProvider = storedDefault ?? DEFAULTS.defaultProvider;

    return {
      defaultProvider,
      autoplayNext: typeof parsed.autoplayNext === 'boolean' ? parsed.autoplayNext : DEFAULTS.autoplayNext,
      accentColor: sanitizeAccentColor(parsed.accentColor),
      englishOnly: typeof parsed.englishOnly === 'boolean' ? parsed.englishOnly : DEFAULTS.englishOnly,
      genreRows: sanitizeGenreRows(parsed.genreRows),
      preferredProviders,
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

/** Remove a per-show pin, falling back to the global default. */
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
