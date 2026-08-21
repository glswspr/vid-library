import { useEffect, useSyncExternalStore } from 'react';
import { getServerHealth, type ServerHealth } from '../utils/storage';

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

export function useServerHealth(provider: string): ServerHealth | null {
  useEffect(() => {
    const handler = () => notify();
    window.addEventListener('server-health-changed', handler);
    return () => window.removeEventListener('server-health-changed', handler);
  }, []);

  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => getServerHealth(provider),
  );
}
