import type { ProviderId } from '../types';

export interface AppSettings {
  defaultProvider: ProviderId;
  autoplayNext: boolean;
  accentColor: string;
}

const SETTINGS_KEY = 'vid_library_settings';
const DEFAULTS: AppSettings = {
  defaultProvider: 'vidrock',
  autoplayNext: true,
  accentColor: '#06b6d4',
};

function readSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      defaultProvider: (parsed.defaultProvider && isValidProvider(parsed.defaultProvider)) ? parsed.defaultProvider : DEFAULTS.defaultProvider,
      autoplayNext: typeof parsed.autoplayNext === 'boolean' ? parsed.autoplayNext : DEFAULTS.autoplayNext,
      accentColor: typeof parsed.accentColor === 'string' ? parsed.accentColor : DEFAULTS.accentColor,
    };
  } catch {
    return DEFAULTS;
  }
}

function isValidProvider(value: unknown): value is ProviderId {
  return typeof value === 'string' && ['vidrock','vidapi','videasy','peachify','vidsrc','vidcore','vidzee'].includes(value);
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
