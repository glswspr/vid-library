import { describe, it, expect } from 'vitest';
import { getSettings, saveSettings, resolveDefaultProvider, setShowDefaultProvider } from './settings';
import { rememberProvider } from './storage';

describe('settings defaults', () => {
  it('starts on 111Movies', () => {
    expect(getSettings().defaultProvider).toBe('m111');
  });

  it('lists 111Movies and StreamX as the first two servers', () => {
    expect(getSettings().preferredProviders.slice(0, 2)).toEqual(['m111', 'streamx']);
  });

  it('persists a changed default server', () => {
    saveSettings({ defaultProvider: 'videasy' });
    expect(getSettings().defaultProvider).toBe('videasy');
  });
});

describe('legacy settings migration', () => {
  it('replaces the old untouched order with the new default', () => {
    localStorage.setItem('vid_library_settings', JSON.stringify({
      defaultProvider: 'vidrock',
      preferredProviders: ['vidrock', 'vidapi', 'videasy', 'peachify', 'vidsrc', 'vidcore', 'vidzee', 'mapple', 'm111', 'streamx'],
    }));
    const settings = getSettings();
    expect(settings.preferredProviders.slice(0, 2)).toEqual(['m111', 'streamx']);
    expect(settings.defaultProvider).toBe('m111');
  });

  it('keeps a customised order and default', () => {
    localStorage.setItem('vid_library_settings', JSON.stringify({
      defaultProvider: 'vidrock',
      preferredProviders: ['vidrock', 'm111'],
    }));
    const settings = getSettings();
    expect(settings.preferredProviders).toEqual(['vidrock', 'm111']);
    expect(settings.defaultProvider).toBe('vidrock');
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
