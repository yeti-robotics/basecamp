import { describe, expect, it } from 'vitest';
import { defaultSeasonDates, isCurrentSeason, overlaps } from './season-dates.js';

describe('season date rules', () => {
  it('suggests May 15 through May 14 of the next year', () => {
    expect(defaultSeasonDates(2026)).toEqual({ startsOn: '2026-05-15', endsOn: '2027-05-14' });
  });

  it('treats both season bounds as inclusive', () => {
    const season = { startsOn: '2026-05-15', endsOn: '2027-05-14' };
    expect(isCurrentSeason(season, '2026-05-14')).toBe(false);
    expect(isCurrentSeason(season, '2026-05-15')).toBe(true);
    expect(isCurrentSeason(season, '2027-05-14')).toBe(true);
    expect(isCurrentSeason(season, '2027-05-15')).toBe(false);
  });

  it('allows adjacent dates but rejects a shared day', () => {
    expect(
      overlaps(
        { startsOn: '2026-05-15', endsOn: '2027-05-14' },
        { startsOn: '2027-05-15', endsOn: '2028-05-14' },
      ),
    ).toBe(false);
    expect(
      overlaps(
        { startsOn: '2026-05-15', endsOn: '2027-05-14' },
        { startsOn: '2027-05-14', endsOn: '2028-05-14' },
      ),
    ).toBe(true);
  });
});
