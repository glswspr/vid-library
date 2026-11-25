import { describe, it, expect } from 'vitest';
import { getSettings } from './settings';
import { PROVIDER_IDS } from '../providers/ids';

describe('the six-server default from the previous build', () => {
  it('is replaced by the eleven-server default', () => {
    localStorage.setItem('vid_library_settings', JSON.stringify({
      defaultProvider: 'vidprime',
      preferredProviders: ['vidprime', 'vixsrc', 'vidnest', 'vidlink', 'peachify', 'vidcore'],
    }));
    const settings = getSettings();
    expect(settings.preferredProviders).toEqual(PROVIDER_IDS);
    expect(settings.defaultProvider).toBe('vidprime');
  });
});
