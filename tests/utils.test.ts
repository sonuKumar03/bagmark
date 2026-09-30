import { describe, it, expect } from 'vitest';
import { formatYearMonth, formatRelativeTime, formatDisplayDate, normalizeUrl } from '../src/lib/utils';

describe('utils', () => {
  it('formats Date to YYYY-MM', () => {
    const d = new Date(2026, 8, 30); // Month is 0-indexed (8 = September)
    expect(formatYearMonth(d)).toBe('2026-09');
  });

  it('normalizes URLs by stripping trailing slashes and common tracking parameters', () => {
    const raw = 'https://example.com/article/?utm_source=twitter&utm_medium=social#heading';
    expect(normalizeUrl(raw)).toBe('https://example.com/article');
  });

  it('formats relative time for recent timestamps', () => {
    const now = 1790800000000;
    const tenMinutesAgo = now - 10 * 60 * 1000;
    const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;
    expect(formatRelativeTime(tenMinutesAgo, now)).toBe('10m ago');
    expect(formatRelativeTime(twoDaysAgo, now)).toBe('2d ago');
  });
});
