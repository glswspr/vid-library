import { describe, it, expect } from 'vitest';
import { getSettings, saveSettings } from './settings';

describe('settings defaults', () => {
  it('returns a default server when nothing is stored', () => {
    expect(getSettings().defaultProvider).toBe('vidrock');
  });

  it('persists a changed default server', () => {
    saveSettings({ defaultProvider: 'videasy' });
    expect(getSettings().defaultProvider).toBe('videasy');
  });
});
