import { describe, expect, it } from 'vitest';
import { formatLocalDate, getWeeklyDateRange } from '../dateRange';

describe('getWeeklyDateRange', () => {
  it('returns Monday-to-Monday boundaries for the current local week', () => {
    const range = getWeeklyDateRange(
      'current',
      new Date(2026, 8, 23, 10, 30),
    );

    expect(range.start).toEqual(new Date(2026, 8, 21, 0, 0, 0, 0));
    expect(range.endExclusive).toEqual(new Date(2026, 8, 28, 0, 0, 0, 0));
    expect(range.isPartialPeriod).toBe(true);
  });

  it('returns the complete previous local week', () => {
    const range = getWeeklyDateRange(
      'previous',
      new Date(2026, 8, 23, 10, 30),
    );

    expect(range.start).toEqual(new Date(2026, 8, 14, 0, 0, 0, 0));
    expect(range.endExclusive).toEqual(new Date(2026, 8, 21, 0, 0, 0, 0));
    expect(range.isPartialPeriod).toBe(false);
  });

  it('crosses a year boundary with local calendar arithmetic', () => {
    const range = getWeeklyDateRange('current', new Date(2027, 0, 1, 8));

    expect(range.start).toEqual(new Date(2026, 11, 28));
    expect(range.endExclusive).toEqual(new Date(2027, 0, 4));
  });
});
describe('formatLocalDate', () => {
  it('formats local components without UTC slicing', () => {
    expect(formatLocalDate(new Date(2026, 0, 2, 0, 30))).toBe('2026-01-02');
  });
});
