import { describe, it, expect } from 'vitest';
import { getSettings, saveSettings, resolveDefaultProvider, setShowDefaultProvider } from './settings';
import { rememberProvider } from './storage';
import { PROVIDER_IDS } from '../providers/ids';

describe('settings defaults', () => {
  it('starts on VidPrime', () => {
    expect(getSettings().defaultProvider).toBe('vidprime');
  });

  it('lists every live server in the default order', () => {
    expect(getSettings().preferredProviders).toEqual(PROVIDER_IDS);
  });

  it('persists a changed default server', () => {
    saveSettings({ defaultProvider: 'vidnest' });
    expect(getSettings().defaultProvider).toBe('vidnest');
  });
});

describe('legacy settings migration', () => {
  it('replaces an untouched order built from dead servers with the default', () => {
    localStorage.setItem('vid_library_settings', JSON.stringify({
      defaultProvider: 'vidrock',
      preferredProviders: ['vidrock', 'vidapi', 'videasy', 'peachify', 'vidsrc', 'vidcore', 'vidzee', 'mapple', 'm111', 'streamx'],
    }));
    const settings = getSettings();
    expect(settings.preferredProviders).toEqual(PROVIDER_IDS);
    expect(settings.defaultProvider).toBe('vidprime');
  });

  it('keeps a customised order, minus servers that no longer play', () => {
    localStorage.setItem('vid_library_settings', JSON.stringify({
      defaultProvider: 'vidrock',
      preferredProviders: ['vidrock', 'vidlink', 'streamx', 'vidsrc', 'vidprime'],
    }));
    const settings = getSettings();
    expect(settings.preferredProviders).toEqual(['vidlink', 'vidsrc', 'vidprime']);
    // The stored default was a dead server, so it resets instead of stranding
    // the player on a frame that cannot load.
    expect(settings.defaultProvider).toBe('vidprime');
  });

  it('keeps a customised order and a live default', () => {
    localStorage.setItem('vid_library_settings', JSON.stringify({
      defaultProvider: 'vidprime',
      preferredProviders: ['vidprime', 'vidlink'],
    }));
    const settings = getSettings();
    expect(settings.preferredProviders).toEqual(['vidprime', 'vidlink']);
    expect(settings.defaultProvider).toBe('vidprime');
  });

  it('drops pins on servers that no longer play', () => {
    localStorage.setItem('vid_library_settings', JSON.stringify({
      showDefaultProviders: { tt1: { provider: 'streamx', title: 'Test' }, tt2: { provider: 'vidlink' } },
    }));
    expect(getSettings().showDefaultProviders).toEqual({ tt2: { provider: 'vidlink' } });
  });
});

describe('resolveDefaultProvider', () => {
  it('uses the global default over a remembered server', () => {
    rememberProvider('tt1', 'vidprime');
    saveSettings({ defaultProvider: 'vidnest' });
    expect(resolveDefaultProvider('tt1')).toBe('vidnest');
  });

  it('still lets a pin beat the global default', () => {
    rememberProvider('tt1', 'vidprime');
    saveSettings({ defaultProvider: 'vidnest' });
    setShowDefaultProvider('tt1', 'vixsrc', 'Test');
    expect(resolveDefaultProvider('tt1')).toBe('vixsrc');
  });
});
