import { describe, it, expect } from 'vitest';
import { readableAccent } from './accent';

describe('readableAccent', () => {
  it('keeps a bright accent unchanged', () => {
    expect(readableAccent('#06b6d4')).toBe('#06b6d4');
  });

  it('lightens a near-black accent', () => {
    expect(readableAccent('#101010')).not.toBe('#101010');
  });

  it('returns a 6-digit hex', () => {
    expect(readableAccent('#101010')).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('leaves an unparseable value alone', () => {
    expect(readableAccent('red')).toBe('red');
  });
});
