import { describe, it, expect } from 'vitest';
import { getProviderFallbackOrder } from './storage';
import { PROVIDER_IDS } from '../providers/ids';

describe('getProviderFallbackOrder', () => {
  it('follows the user order exactly', () => {
    expect(getProviderFallbackOrder(['vixsrc', 'vidprime'])).toEqual(['vixsrc', 'vidprime']);
  });

  it('does not add servers the user removed from the order', () => {
    expect(getProviderFallbackOrder(['vidprime'])).toEqual(['vidprime']);
  });

  it('ignores ids of servers that no longer exist', () => {
    expect(getProviderFallbackOrder(['streamx' as never, 'vidprime'])).toEqual(['vidprime']);
  });

  it('uses the full live list when the order is empty', () => {
    const order = getProviderFallbackOrder([]);
    expect(order).toEqual(PROVIDER_IDS);
    expect(order[0]).toBe('vidprime');
  });
});
