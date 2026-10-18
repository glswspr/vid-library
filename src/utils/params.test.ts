import { describe, it, expect } from 'vitest';
import { parsePositiveInt } from './params';

describe('parsePositiveInt', () => {
  it('parses a normal value', () => expect(parsePositiveInt('3', 1)).toBe(3));
  it('falls back for undefined', () => expect(parsePositiveInt(undefined, 1)).toBe(1));
  it('falls back for text', () => expect(parsePositiveInt('abc', 1)).toBe(1));
  it('falls back for zero', () => expect(parsePositiveInt('0', 1)).toBe(1));
  it('falls back for a negative number', () => expect(parsePositiveInt('-2', 1)).toBe(1));
  it('truncates a decimal', () => expect(parsePositiveInt('2.9', 1)).toBe(2));
});
