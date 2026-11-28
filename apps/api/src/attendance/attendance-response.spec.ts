import { describe, expect, it } from 'vitest';
import type { AttendanceLeaderboard, AttendanceOverview } from './attendance.service.js';
import {
  formatAttendanceLeaderboard,
  formatAttendanceOverview,
  formatAttendanceReadError,
} from './attendance-response.js';

function makeOverview(overrides: Partial<AttendanceOverview> = {}): AttendanceOverview {
  return {
    season: { id: 1, name: '2026–27' },
    hours: { meeting: 12, outreach: 5, total: 17 },
    requirements: {
      meeting: 26,
      outreach: 5,
      track: 'member',
    },
    progress: {
      completedMeetings: 5,
      attendedMeetings: 3,
      excusedMeetings: 1,
      missedMeetings: 1,
      completedMeetingHours: 16,
      scheduledMeetingHours: 40,
      expectedHours: {
        member: 10.4,
        leadership: 15.6,
      },
    },
    recentActivity: [],
    ...overrides,
  };
}

function makeLeaderboard(overrides: Partial<AttendanceLeaderboard> = {}): AttendanceLeaderboard {
  return {
    season: { id: 1, name: '2026–27' },
    entries: [
      { rank: 1, name: 'Ada Lovelace', hours: 20 },
      { rank: 2, name: 'Grace Hopper', hours: 18.5 },
      { rank: 2, name: 'Alex Morgan', hours: 18.5 },
      { rank: 4, name: 'Sam Wilson', hours: 15 },
      { rank: 5, name: 'Taylor Smith', hours: 12 },
    ],
    ...overrides,
  };
}

describe('formatAttendanceOverview', () => {
  it('displays the active season and recorded meeting hours', () => {
    const message = formatAttendanceOverview(makeOverview());

    expect(message).toContain('**Your attendance progress**');
    expect(message).toContain('Season: 2026–27');
    expect(message).toContain('**Recorded meeting hours:** 12.00h');
  });

  it('uses the regular student attendance requirement', () => {
    const message = formatAttendanceOverview(makeOverview());

    expect(message).toContain('**Expected hours to date:** 10.40h');
    expect(message).toContain('**Requirement:** Student');
    expect(message).toContain('**Progress:** 115.4%');
    expect(message).toContain('You have met your attendance goal');
    expect(message).not.toContain('**Hours remaining:**');
  });

  it('uses the leadership requirement for a Student Leader', () => {
    const message = formatAttendanceOverview(
      makeOverview({
        requirements: {
          meeting: 39,
          outreach: 5,
          track: 'leadership',
        },
      }),
    );

    expect(message).toContain('**Requirement:** Student Leader');
    expect(message).toContain('**Expected hours to date:** 15.60h');
    expect(message).toContain('**Progress:** 76.9%');
    expect(message).toContain('**Hours remaining:** 3.60h');
  });

  it('shows the remaining hours for a student behind their goal', () => {
    const message = formatAttendanceOverview(
      makeOverview({
        hours: { meeting: 6.5, outreach: 0, total: 6.5 },
      }),
    );

    expect(message).toContain('**Progress:** 62.5%');
    expect(message).toContain('**Hours remaining:** 3.90h');
    expect(message).not.toContain('You have met your attendance goal');
  });

  it('recognizes when recorded hours exactly meet the goal', () => {
    const message = formatAttendanceOverview(
      makeOverview({
        hours: { meeting: 10.4, outreach: 0, total: 10.4 },
      }),
    );

    expect(message).toContain('**Progress:** 100.0%');
    expect(message).toContain('You have met your attendance goal');
    expect(message).not.toContain('**Hours remaining:**');
  });

  it('does not report negative remaining hours', () => {
    const message = formatAttendanceOverview(
      makeOverview({
        hours: { meeting: 40, outreach: 0, total: 40 },
      }),
    );

    expect(message).toContain('You have met your attendance goal');
    expect(message).not.toContain('**Hours remaining:**');
  });

  it('handles zero expected hours without dividing by zero', () => {
    const overview = makeOverview({
      hours: { meeting: 0, outreach: 0, total: 0 },
    });

    const progress = {
      ...overview.progress!,
      completedMeetings: 0,
      attendedMeetings: 0,
      excusedMeetings: 0,
      missedMeetings: 0,
      completedMeetingHours: 0,
      expectedHours: { member: 0, leadership: 0 },
    };

    const message = formatAttendanceOverview({
      ...overview,
      progress,
    });

    expect(message).toContain('No meeting hours are required yet.');
    expect(message).not.toMatch(/Infinity|NaN|∞/);
    expect(message).not.toContain('**Progress:**');
  });

  it('handles a missing configured attendance requirement', () => {
    const overview = makeOverview();

    const message = formatAttendanceOverview({
      ...overview,
      progress: {
        ...overview.progress!,
        expectedHours: { member: null, leadership: null },
      },
    });

    expect(message).toContain('No meeting-hour requirement is configured for you.');
    expect(message).not.toContain('**Progress:**');
  });

  it('handles an installation without an active season', () => {
    const message = formatAttendanceOverview(
      makeOverview({
        season: null,
        requirements: null,
        progress: null,
      }),
    );

    expect(message).toBe('There is no active season. Contact a Team Admin for assistance.');
  });

  it('handles a person without an active season membership', () => {
    const message = formatAttendanceOverview(makeOverview({ requirements: null }));

    expect(message).toContain('You do not have an active season membership.');
    expect(message).not.toContain('**Progress:**');
  });

  it('handles unavailable meeting progress', () => {
    const message = formatAttendanceOverview(makeOverview({ progress: null }));

    expect(message).toContain('Meeting progress is not available yet.');
    expect(message).toContain('**Recorded meeting hours:** 12.00h');
  });

  it('shows attended, excused, missed and completed meeting totals', () => {
    const message = formatAttendanceOverview(makeOverview());

    expect(message).toContain('**Completed meetings**');
    expect(message).toContain('Attended: 3');
    expect(message).toContain('Excused: 1');
    expect(message).toContain('Missed: 1');
    expect(message).toContain('Total: 5');
  });

  it('reports an open session found in recent activity', () => {
    const message = formatAttendanceOverview(
      makeOverview({
        recentActivity: [
          {
            id: 1,
            category: 'meeting',
            status: 'normal',
            name: 'Team meeting',
            checkedInAt: '2026-11-27T17:00:00.000Z',
            checkedOutAt: null,
            hours: 0,
          },
        ],
      }),
    );

    expect(message).toContain('You have a session without a sign-out.');
  });

  it('does not identify completed attendance as an open session', () => {
    const message = formatAttendanceOverview(
      makeOverview({
        recentActivity: [
          {
            id: 1,
            category: 'meeting',
            status: 'normal',
            name: 'Team meeting',
            checkedInAt: '2026-11-27T17:00:00.000Z',
            checkedOutAt: '2026-11-27T19:00:00.000Z',
            hours: 2,
          },
        ],
      }),
    );

    expect(message).toContain('No open session found in recent activity.');
  });

  it('handles an empty recent attendance history', () => {
    const message = formatAttendanceOverview(makeOverview({ recentActivity: [] }));

    expect(message).toContain('No open session found in recent activity.');
  });

  it('directs members to the dashboard for attendance history', () => {
    const message = formatAttendanceOverview(makeOverview());

    expect(message).toContain('Use the Basecamp dashboard to view your attendance history.');
  });

  it('escapes markdown in the season name', () => {
    const message = formatAttendanceOverview(
      makeOverview({
        season: { id: 1, name: '**Test season**' },
      }),
    );

    expect(message).toContain('Season: \\*\\*Test season\\*\\*');
  });

  it('does not mutate the supplied overview', () => {
    const overview = makeOverview();
    const before = structuredClone(overview);

    formatAttendanceOverview(overview);

    expect(overview).toEqual(before);
  });
});

describe('formatAttendanceLeaderboard', () => {
  it('displays the current season and ranked student hours', () => {
    const message = formatAttendanceLeaderboard(makeLeaderboard());

    expect(message).toContain('**Attendance Leaderboard**');
    expect(message).toContain('Season: 2026–27');
    expect(message).toContain('**1.** Ada Lovelace — 20.00h');
    expect(message).toContain('**5.** Taylor Smith — 12.00h');
  });

  it('preserves competition ranking for tied students', () => {
    const message = formatAttendanceLeaderboard(makeLeaderboard());

    expect(message).toContain('**2.** Grace Hopper — 18.50h');
    expect(message).toContain('**2.** Alex Morgan — 18.50h');
    expect(message).toContain('**4.** Sam Wilson — 15.00h');
    expect(message).not.toContain('**3.**');
  });

  it('displays at most five leaderboard entries', () => {
    const leaderboard = makeLeaderboard();

    const message = formatAttendanceLeaderboard({
      ...leaderboard,
      entries: [...leaderboard.entries, { rank: 6, name: 'Sixth Student', hours: 10 }],
    });

    expect(message).toContain('Taylor Smith');
    expect(message).not.toContain('Sixth Student');
  });

  it('handles a leaderboard with fewer than five students', () => {
    const message = formatAttendanceLeaderboard(
      makeLeaderboard({
        entries: [{ rank: 1, name: 'Ada Lovelace', hours: 10 }],
      }),
    );

    expect(message).toContain('**1.** Ada Lovelace — 10.00h');
    expect(message).not.toContain('**2.**');
  });

  it('handles a season without recorded student hours', () => {
    const message = formatAttendanceLeaderboard(makeLeaderboard({ entries: [] }));

    expect(message).toBe('No completed student meeting hours have been recorded for 2026–27.');
  });

  it('handles an installation without an active season', () => {
    const message = formatAttendanceLeaderboard(
      makeLeaderboard({
        season: null,
        entries: [],
      }),
    );

    expect(message).toBe('There is no active season to display rankings for.');
  });

  it('formats fractional hours to two decimal places', () => {
    const message = formatAttendanceLeaderboard(
      makeLeaderboard({
        entries: [{ rank: 1, name: 'Ada', hours: 12.345 }],
      }),
    );

    expect(message).toContain('12.35h');
  });

  it('escapes markdown characters in student names', () => {
    const message = formatAttendanceLeaderboard(
      makeLeaderboard({
        entries: [{ rank: 1, name: '**Ada**', hours: 12 }],
      }),
    );

    expect(message).toContain('\\*\\*Ada\\*\\*');
  });

  it('normalizes multiline student names', () => {
    const message = formatAttendanceLeaderboard(
      makeLeaderboard({
        entries: [
          {
            rank: 1,
            name: 'Ada\n\nLovelace\tSmith',
            hours: 12,
          },
        ],
      }),
    );

    expect(message).toContain('Ada Lovelace Smith');
    expect(message).not.toContain('Ada\n\nLovelace');
  });

  it('handles a student with an empty display name', () => {
    const message = formatAttendanceLeaderboard(
      makeLeaderboard({
        entries: [{ rank: 1, name: '   ', hours: 12 }],
      }),
    );

    expect(message).toContain('Unknown member');
  });

  it('limits excessively long display names', () => {
    const message = formatAttendanceLeaderboard(
      makeLeaderboard({
        entries: [{ rank: 1, name: 'A'.repeat(500), hours: 12 }],
      }),
    );

    expect(message).toContain('A'.repeat(100));
    expect(message).not.toContain('A'.repeat(101));
  });

  it('stays within the Discord message content limit', () => {
    const message = formatAttendanceLeaderboard(
      makeLeaderboard({
        season: { id: 1, name: '*'.repeat(500) },
        entries: Array.from({ length: 5 }, (_, index) => ({
          rank: index + 1,
          name: '*'.repeat(500),
          hours: 10,
        })),
      }),
    );

    expect(message.length).toBeLessThanOrEqual(2000);
  });

  it('explains which attendance hours and memberships are ranked', () => {
    const message = formatAttendanceLeaderboard(makeLeaderboard());

    expect(message).toContain('Rankings are based on credited current-season meeting hours.');

    expect(message).toContain('Only active students and Student Leaders are included.');
  });

  it('does not modify the supplied leaderboard', () => {
    const leaderboard = makeLeaderboard();
    const before = structuredClone(leaderboard);

    formatAttendanceLeaderboard(leaderboard);

    expect(leaderboard).toEqual(before);
  });
});

describe('formatAttendanceReadError', () => {
  it('provides an onboarding path for an unlinked Discord identity', () => {
    expect(formatAttendanceReadError(new Error('User not found'))).toBe(
      'Your Discord account is not linked to Basecamp. Sign in to the dashboard first.',
    );
  });

  it('explains suspended-account restrictions', () => {
    expect(formatAttendanceReadError(new Error('Account is suspended'))).toBe(
      'Your Basecamp access is suspended. Contact a Team Admin for assistance.',
    );
  });

  it('explains mentor and Team Admin authorization requirements', () => {
    expect(formatAttendanceReadError(new Error('Not authorized to manage attendance'))).toBe(
      'Only active mentors and Team Admins can use this command.',
    );
  });

  it('explains removed season memberships', () => {
    expect(formatAttendanceReadError(new Error('Season membership is removed'))).toBe(
      'Your membership in this season has been removed. Contact a Team Admin.',
    );
  });

  it('does not expose internal database errors to Discord users', () => {
    const message = formatAttendanceReadError(
      new Error('Database connection failed: internal database host'),
    );

    expect(message).toBe('Attendance could not be loaded. Please try again or ask a mentor.');

    expect(message).not.toContain('internal database host');
  });
});
