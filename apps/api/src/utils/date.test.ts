import { describe, it, expect } from 'vitest';
import { inclusiveDays, dateRangeOverlaps, eachDate, toDateOnly } from './date';

describe('inclusiveDays', () => {
  it('counts a single day as 1', () => {
    expect(inclusiveDays(new Date(2026, 7, 1), new Date(2026, 7, 1))).toBe(1);
  });
  it('counts inclusive range', () => {
    expect(inclusiveDays(new Date(2026, 7, 1), new Date(2026, 7, 5))).toBe(5);
  });
});

describe('dateRangeOverlaps', () => {
  const a = { s: new Date(2026, 7, 1), e: new Date(2026, 7, 5) };
  it('overlaps when ranges intersect', () => {
    expect(dateRangeOverlaps(a.s, a.e, new Date(2026, 7, 4), new Date(2026, 7, 8))).toBe(true);
  });
  it('overlaps when identical', () => {
    expect(dateRangeOverlaps(a.s, a.e, new Date(2026, 7, 1), new Date(2026, 7, 5))).toBe(true);
  });
  it('does not overlap when disjoint', () => {
    expect(dateRangeOverlaps(a.s, a.e, new Date(2026, 7, 6), new Date(2026, 7, 9))).toBe(false);
  });
  it('touching dates are NOT an overlap', () => {
    expect(dateRangeOverlaps(a.s, a.e, new Date(2026, 7, 6), new Date(2026, 7, 6))).toBe(false);
  });
});

describe('eachDate', () => {
  it('iterates inclusive dates', () => {
    const dates = Array.from(eachDate(new Date(2026, 7, 1), new Date(2026, 7, 3)));
    expect(dates).toHaveLength(3);
    expect(dates.map((d) => d.getDate())).toEqual([1, 2, 3]);
  });
  it('strips time to local date', () => {
    expect(toDateOnly(new Date(2026, 7, 1, 23, 59))).toEqual(new Date(2026, 7, 1));
  });
});