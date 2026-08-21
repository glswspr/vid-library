import { useEffect, useState, useCallback } from 'react';
import { getSettings, saveSettings, type AppSettings } from '../utils/settings';

export function useSettings(): [AppSettings, (partial: Partial<AppSettings>) => void] {
  const [settings, setSettings] = useState<AppSettings>(() => getSettings());

  const update = useCallback((partial: Partial<AppSettings>) => {
    const next = saveSettings(partial);
    setSettings(next);
  }, []);

  useEffect(() => {
    const handler = () => setSettings(getSettings());
    window.addEventListener('settings-changed', handler);
    return () => window.removeEventListener('settings-changed', handler);
  }, []);

  return [settings, update];
}
