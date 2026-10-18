import type { WatchProgress } from '../types';

/**
 * Estimated time spent watching, in seconds.
 *
 * A finished title counts as its full duration (the player reports a tiny
 * position when it ends). An unfinished one counts as its position, capped at
 * the duration. Entries without a duration are skipped.
 *
 * This is an estimate: rewatching a title does not add to the total, because a
 * progress entry stores a position, not accumulated time.
 */
export function computeWatchTime(items: WatchProgress[]): number {
  let total = 0;
  for (const item of items) {
    if (!item.duration || item.duration <= 0) continue;
    total += item.completed ? item.duration : Math.min(item.progress, item.duration);
  }
  return total;
}
