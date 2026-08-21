import { useEffect, useState } from 'react';
import type { FC } from 'react';

export function getServerStatus(provider: string): 'ok' | 'bad' | 'unknown' {
  try {
    const raw = localStorage.getItem('vid_library_server_health');
    if (!raw) return 'unknown';
    const s = JSON.parse(raw)[provider];
    if (!s) return 'unknown';
    return s.success > s.failure ? 'ok' : 'bad';
  } catch {
    return 'unknown';
  }
}

const ServerStatusDot: FC<{ provider: string }> = ({ provider }) => {
  const [status, setStatus] = useState<'ok' | 'bad' | 'unknown'>(() => getServerStatus(provider));

  useEffect(() => {
    const update = () => setStatus(getServerStatus(provider));
    window.addEventListener('server-health-changed', update);
    return () => window.removeEventListener('server-health-changed', update);
  }, [provider]);

  const color = status === 'ok' ? 'bg-emerald-400' : status === 'bad' ? 'bg-rose-400' : 'bg-slate-500';

  return <span className={`${color} w-2 h-2 rounded-full inline-block`} aria-hidden="true" />;
};

export default ServerStatusDot;
