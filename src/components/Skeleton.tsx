import type { FC } from 'react';

interface SkeletonProps {
  className?: string;
}

/** Lightweight loading placeholder (pulse block). Keeps pages calm while data loads. */
export const Skeleton: FC<SkeletonProps> = ({ className }) => (
  <div className={`animate-pulse bg-slate-800/60 rounded-xl ${className || ''}`} />
);
