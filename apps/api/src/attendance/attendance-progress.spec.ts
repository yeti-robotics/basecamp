import { describe, expect, it } from 'vitest';
import {
  calculateMeetingProgress,
  meetingOutcome,
  type ProgressMeeting,
  type ProgressRecord,
  recordCoversMeeting,
} from './attendance-progress.js';

const now = new Date('2026-11-09T23:00:00.000Z');

function meeting(id: number, startsAt: string, hours: number): ProgressMeeting {
  const start = new Date(startsAt);
  return { id, startsAt: start, endsAt: new Date(start.getTime() + hours * 3_600_000) };
}

function record(overrides: Partial<ProgressRecord>): ProgressRecord {
  return {
    eventId: null,
    category: 'meeting',
    status: 'normal',
    checkedInAt: new Date('2026-11-03T21:30:00.000Z'),
    checkedOutAt: new Date('2026-11-04T00:30:00.000Z'),
    ...overrides,
  };
}

const tuesday = meeting(1, '2026-11-03T21:30:00.000Z', 3);
const thursday = meeting(2, '2026-11-05T21:30:00.000Z', 3);
const saturday = meeting(3, '2026-11-07T14:00:00.000Z', 4);
const nextTuesday = meeting(4, '2026-11-10T21:30:00.000Z', 3);

describe('recordCoversMeeting', () => {
  it('matches a record linked to the meeting even when its times do not overlap', () => {
    expect(
      recordCoversMeeting(
        record({ eventId: 2, checkedInAt: new Date('2026-11-01T12:00:00Z') }),
        thursday,
      ),
    ).toBe(true);
  });

  it('matches a record that overlaps the meeting time', () => {
    const lateArrival = record({
      checkedInAt: new Date('2026-11-03T23:00:00Z'),
      checkedOutAt: new Date('2026-11-04T01:00:00Z'),
    });
    expect(recordCoversMeeting(lateArrival, tuesday)).toBe(true);
  });

  it('does not match a record that ends as the meeting starts', () => {
    const before = record({
      checkedInAt: new Date('2026-11-03T19:00:00Z'),
      checkedOutAt: tuesday.startsAt,
    });
    expect(recordCoversMeeting(before, tuesday)).toBe(false);
  });

  it('counts an open sign-in only until it would expire', () => {
    const open = record({ checkedOutAt: null });
    expect(recordCoversMeeting(open, tuesday)).toBe(true);
    expect(recordCoversMeeting(open, thursday)).toBe(false);
  });
});

describe('meetingOutcome', () => {
  it('prefers attendance over an excuse for the same meeting', () => {
    expect(meetingOutcome(tuesday, [record({ status: 'excused' }), record({})])).toBe('attended');
    expect(meetingOutcome(tuesday, [record({ status: 'manual' })])).toBe('attended');
  });

  it('marks an excused meeting separately from a missed one', () => {
    expect(meetingOutcome(tuesday, [record({ status: 'excused' })])).toBe('excused');
    expect(meetingOutcome(tuesday, [])).toBe('missed');
  });

  it('ignores outreach records', () => {
    expect(meetingOutcome(tuesday, [record({ category: 'outreach' })])).toBe('missed');
  });
});

describe('calculateMeetingProgress', () => {
  it('counts attended, excused, and missed meetings that have finished', () => {
    const progress = calculateMeetingProgress(
      [tuesday, thursday, saturday, nextTuesday],
      [
        record({}),
        record({
          eventId: 3,
          status: 'excused',
          checkedInAt: saturday.startsAt,
          checkedOutAt: saturday.endsAt,
        }),
      ],
      { member: 26, leadership: 39 },
      now,
    );

    expect(progress).toEqual({
      completedMeetings: 3,
      attendedMeetings: 1,
      excusedMeetings: 1,
      missedMeetings: 1,
      completedMeetingHours: 10,
      scheduledMeetingHours: 13,
      expectedHours: { member: 20, leadership: 30 },
    });
  });

  it('expects the full requirement once every scheduled meeting has finished', () => {
    const progress = calculateMeetingProgress(
      [tuesday, thursday],
      [],
      { member: 4.5, leadership: null },
      now,
    );

    expect(progress.expectedHours).toEqual({ member: 4.5, leadership: null });
    expect(progress.missedMeetings).toBe(2);
  });

  it('expects nothing before any meetings are scheduled or finished', () => {
    expect(
      calculateMeetingProgress([], [], { member: 26, leadership: 39 }, now).expectedHours,
    ).toEqual({ member: 0, leadership: 0 });
    expect(
      calculateMeetingProgress([nextTuesday], [], { member: 26, leadership: 39 }, now),
    ).toMatchObject({ completedMeetings: 0, expectedHours: { member: 0, leadership: 0 } });
  });
});
