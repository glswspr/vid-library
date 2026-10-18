import { describe, it, expect } from 'vitest';
import { computeWatchTime } from './watchStats';
import type { WatchProgress } from '../types';

const base: WatchProgress = {
  id: 'tt1',
  title: 'T',
  type: 'movie',
  progress: 0,
  duration: 3600,
  updatedAt: 1,
};

describe('computeWatchTime', () => {
  it('counts a finished title as its full duration', () => {
    expect(computeWatchTime([{ ...base, progress: 60, completed: true }])).toBe(3600);
  });

  it('counts an unfinished title by its position', () => {
    expect(computeWatchTime([{ ...base, progress: 600 }])).toBe(600);
  });

  it('never counts more than the duration', () => {
    expect(computeWatchTime([{ ...base, progress: 9999, duration: 3600 }])).toBe(3600);
  });

  it('ignores entries with no duration', () => {
    expect(computeWatchTime([{ ...base, progress: 600, duration: 0 }])).toBe(0);
  });
});
