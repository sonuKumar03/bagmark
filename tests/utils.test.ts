import { describe, it, expect } from 'vitest';
import { formatYearMonth, formatRelativeTime, formatDisplayDate, normalizeUrl } from '../src/lib/utils';

describe('utils', () => {
  it('formats Date to YYYY-MM', () => {
    const d = new Date(2026, 8, 30); // Month is 0-indexed (8 = September)
    expect(formatYearMonth(d)).toBe('2026-09');
  });

  it('formats current date to YYYY-MM by default', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    expect(formatYearMonth()).toBe(expected);
  });

  it('formats timestamp into expected display date', () => {
    const d = new Date(2026, 8, 30, 15, 30);
    const formatted = formatDisplayDate(d.getTime());
    expect(formatted).toContain('Sep 30, 2026');
    expect(formatted).toMatch(/3:30\s*PM/);
  });

  it('strips known tracking parameters while preserving paths and fragments', () => {
    const raw = 'https://example.com/article/?utm_source=twitter&utm_medium=social#heading';
    expect(normalizeUrl(raw)).toBe('https://example.com/article/#heading');
  });

  it('preserves functional query parameters and distinct paths', () => {
    const raw = 'https://example.com/article/?id=1&ref=books#chapter';
    expect(normalizeUrl(raw)).toBe(raw);
    expect(normalizeUrl('https://example.com/article')).not.toBe(normalizeUrl('https://example.com/article/'));
    expect(normalizeUrl('https://example.com/#/one')).not.toBe(normalizeUrl('https://example.com/#/two'));
  });

  it('formats relative time for recent timestamps', () => {
    const now = 1790800000000;
    const tenMinutesAgo = now - 10 * 60 * 1000;
    const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;
    expect(formatRelativeTime(tenMinutesAgo, now)).toBe('10m ago');
    expect(formatRelativeTime(twoDaysAgo, now)).toBe('2d ago');
  });

  it('handles future timestamp or slight clock drift as just now', () => {
    const now = 1790800000000;
    const future = now + 5000; // 5 seconds ahead
    expect(formatRelativeTime(future, now)).toBe('just now');
  });
});
