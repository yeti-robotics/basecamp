import type { TeamEvent } from '@/lib/events';
import {
  generateCalendarDays,
  getDaysInMonth,
  getEventsForDay,
  getFirstDayOfMonth,
  getTeamDateKey,
} from './calendar-utils';

// A sample event that replaces real database data during testing.
const mockEvent: TeamEvent = {
  id: 1,
  seasonId: 1,
  seasonName: '2026-27',
  name: 'Build meeting',
  description: null,
  location: 'Robotics lab',
  startsAt: '2026-12-05T22:00:00.000Z',
  endsAt: '2026-12-06T01:00:00.000Z',
  eventType: 'meeting',
  hourCategory: 'meeting',
  status: 'scheduled',
};

describe('Calendar utilities', () => {
  // Verify that different months have the correct lengths.
  it('returns the correct number of days in a month', () => {
    expect(getDaysInMonth(2026, 11)).toBe(31);
    expect(getDaysInMonth(2026, 1)).toBe(28);
  });

  it('handles leap years', () => {
    expect(getDaysInMonth(2028, 1)).toBe(29);
  });

  it('returns the correct starting weekday', () => {
    expect(getFirstDayOfMonth(2026, 11)).toBe(2);
  });

  it('generates complete calendar weeks', () => {
    const days = generateCalendarDays(2026, 11);

    expect(days.length).toBe(35);
    expect(days.slice(0, 3)).toEqual([null, null, 1]);
    expect(days.length % 7).toBe(0);
  });

  it('includes every day of the month', () => {
    const days = generateCalendarDays(2026, 11);

    expect(days.filter((day) => day !== null)).toHaveLength(31);
  });

  // Although it is December 6 in UTC, it is still December 5
  // in North Carolina.
  it('converts UTC timestamps to Eastern Time', () => {
    expect(getTeamDateKey('2026-12-06T01:00:00.000Z')).toBe('2026-12-05');
  });

  it('handles daylight saving time', () => {
    expect(getTeamDateKey('2026-07-05T04:30:00.000Z')).toBe('2026-07-05');
  });

  it('returns events for the selected date', () => {
    expect(getEventsForDay([mockEvent], 2026, 11, 5)).toEqual([mockEvent]);
  });

  it('does not place events on the wrong date', () => {
    expect(getEventsForDay([mockEvent], 2026, 11, 6)).toEqual([]);
  });

  it('keeps cancelled events visible', () => {
    const cancelledEvent: TeamEvent = {
      ...mockEvent,
      status: 'cancelled',
    };

    expect(getEventsForDay([cancelledEvent], 2026, 11, 5)).toEqual([cancelledEvent]);
  });

  it('includes events that span multiple days', () => {
    const overnightEvent: TeamEvent = {
      ...mockEvent,
      endsAt: '2026-12-06T07:00:00.000Z',
    };

    expect(getEventsForDay([overnightEvent], 2026, 11, 6)).toEqual([overnightEvent]);
  });

  it('excludes the next day when an event ends at midnight', () => {
    const midnightEvent: TeamEvent = {
      ...mockEvent,
      endsAt: '2026-12-06T05:00:00.000Z',
    };

    expect(getEventsForDay([midnightEvent], 2026, 11, 6)).toEqual([]);
  });

  it('handles an empty event list', () => {
    expect(getEventsForDay([], 2026, 11, 5)).toEqual([]);
  });
});
