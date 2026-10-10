import { useEffect, useRef, useState } from 'react';
import type { FC } from 'react';
import { X } from 'lucide-react';

interface ToastProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

export const Toast: FC<ToastProps> = ({ message, actionLabel, onAction, durationMs = 6000 }) => {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    timerRef.current = window.setTimeout(() => setVisible(false), durationMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [durationMs]);

  const handleDismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3 px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl shadow-black/50 text-sm text-slate-200 animate-slide-up">
      <span>{message}</span>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={() => { onAction(); handleDismiss(); }}
          className="font-semibold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
