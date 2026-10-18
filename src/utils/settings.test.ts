import { describe, it, expect } from 'vitest';
import { getSettings, saveSettings, resolveDefaultProvider, setShowDefaultProvider } from './settings';
import { rememberProvider } from './storage';

describe('settings defaults', () => {
  it('returns a default server when nothing is stored', () => {
    expect(getSettings().defaultProvider).toBe('vidrock');
  });

  it('persists a changed default server', () => {
    saveSettings({ defaultProvider: 'videasy' });
    expect(getSettings().defaultProvider).toBe('videasy');
  });
});

describe('resolveDefaultProvider', () => {
  it('uses the global default over a remembered server', () => {
    rememberProvider('tt1', 'm111');
    saveSettings({ defaultProvider: 'videasy' });
    expect(resolveDefaultProvider('tt1')).toBe('videasy');
  });

  it('still lets a pin beat the global default', () => {
    rememberProvider('tt1', 'm111');
    saveSettings({ defaultProvider: 'videasy' });
    setShowDefaultProvider('tt1', 'vidapi', 'Test');
    expect(resolveDefaultProvider('tt1')).toBe('vidapi');
  });
});
