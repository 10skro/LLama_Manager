import { describe, it, expect } from 'vitest';
import { formatDate, formatSize, formatRelativeTime } from './format';

describe('formatSize', () => {
  it('returns "0 B" for 0 bytes', () => {
    expect(formatSize(0)).toBe('0 B');
  });

  it('formats kilobytes', () => {
    expect(formatSize(1024)).toBe('1 KB');
  });

  it('formats megabytes', () => {
    expect(formatSize(1048576)).toBe('1 MB');
  });

  it('formats gigabytes', () => {
    expect(formatSize(1073741824)).toBe('1 GB');
  });
});

describe('formatDate', () => {
  it('formats ISO date string', () => {
    const result = formatDate('2024-01-15');
    expect(result).toContain('2024');
  });
});

describe('formatRelativeTime', () => {
  it('returns "just now" for current time', () => {
    expect(formatRelativeTime(new Date().toISOString())).toBe('just now');
  });

  it('returns minutes for recent time', () => {
    const past = new Date(Date.now() - 120 * 1000);
    expect(formatRelativeTime(past.toISOString())).toBe('2 min ago');
  });

  it('returns hours for older time', () => {
    const past = new Date(Date.now() - 120 * 60 * 1000);
    expect(formatRelativeTime(past.toISOString())).toBe('2 hours ago');
  });

  it('returns days for old time', () => {
    const past = new Date(Date.now() - 48 * 60 * 60 * 1000);
    expect(formatRelativeTime(past.toISOString())).toBe('2 days ago');
  });
});
