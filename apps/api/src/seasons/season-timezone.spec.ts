import { describe, expect, it } from 'vitest';
import { localDateInTimeZone, localMidnightInTimeZone } from './season-timezone.js';

describe('season timezone boundaries', () => {
  it('uses the configured local calendar day at a UTC boundary', () => {
    expect(localDateInTimeZone(new Date('2026-05-15T03:59:59.000Z'), 'America/New_York')).toBe(
      '2026-05-14',
    );
    expect(localDateInTimeZone(new Date('2026-05-15T04:00:00.000Z'), 'America/New_York')).toBe(
      '2026-05-15',
    );
  });

  it('converts local midnight using the timezone offset for that date', () => {
    expect(localMidnightInTimeZone('2026-05-15', 'America/New_York').toISOString()).toBe(
      '2026-05-15T04:00:00.000Z',
    );
    expect(localMidnightInTimeZone('2026-11-02', 'America/New_York').toISOString()).toBe(
      '2026-11-02T05:00:00.000Z',
    );
  });
});
