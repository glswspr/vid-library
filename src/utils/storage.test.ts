import { describe, it, expect } from 'vitest';
import { getProviderFallbackOrder } from './storage';

describe('getProviderFallbackOrder', () => {
  it('follows the user order exactly', () => {
    expect(getProviderFallbackOrder(['streamx', 'vidapi'])).toEqual(['streamx', 'vidapi']);
  });

  it('does not add servers the user removed from the order', () => {
    expect(getProviderFallbackOrder(['vidapi'])).toEqual(['vidapi']);
  });

  it('ignores invalid ids', () => {
    expect(getProviderFallbackOrder(['nope' as never, 'vidapi'])).toEqual(['vidapi']);
  });

  it('uses the full list when the order is empty', () => {
    const order = getProviderFallbackOrder([]);
    expect(order.length).toBeGreaterThan(1);
    expect(order[0]).toBe('m111');
  });
});
