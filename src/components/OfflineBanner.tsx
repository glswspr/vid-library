import type { FC } from 'react';
import { WifiOff } from 'lucide-react';
import { useOnline } from '../hooks/useOnline';

export const OfflineBanner: FC = () => {
  const online = useOnline();
  if (online) return null;

  return (
    <div className="bg-amber-500/90 text-slate-950 px-4 py-2 text-center text-sm font-semibold flex items-center justify-center gap-2">
      <WifiOff className="w-4 h-4" />
      You are offline. Some features may be unavailable.
    </div>
  );
};
