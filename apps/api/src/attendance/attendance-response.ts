import type { AttendanceLeaderboard, AttendanceOverview } from './attendance.service.js';

const MAX_NAME_LENGTH = 100;

function safeDisplayName(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .replace(/[\\`*_~|[\]<>#]/g, '\\$&');
}

function formatHours(hours: number): string {
  return `${hours.toFixed(2)}h`;
}

export function formatAttendanceReadError(error: Error): string {
  switch (error.message) {
    case 'User not found':
      return 'Your Discord account is not linked to Basecamp. Sign in to the dashboard first.';

    case 'Account is suspended':
      return 'Your Basecamp access is suspended. Contact a Team Admin for assistance.';

    case 'Not authorized to manage attendance':
      return 'Only active mentors and Team Admins can use this command.';

    case 'Season membership is removed':
      return 'Your membership in this season has been removed. Contact a Team Admin.';

    default:
      return 'Attendance could not be loaded. Please try again or ask a mentor.';
  }
}

export function formatAttendanceOverview(overview: AttendanceOverview): string {
  if (!overview.season) {
    return 'There is no active season. Contact a Team Admin for assistance.';
  }

  const { season, hours, requirements, progress, recentActivity } = overview;

  if (!requirements) {
    return 'You do not have an active season membership. Check your membership in the Basecamp dashboard.';
  }

  const lines = [
    '**Your attendance progress**',
    `Season: ${safeDisplayName(season.name)}`,
    '',
    `**Recorded meeting hours:** ${formatHours(hours.meeting)}`,
  ];

  if (progress) {
    const expected = progress.expectedHours[requirements.track];

    if (expected === null) {
      lines.push('No meeting-hour requirement is configured for you.');
    } else if (expected === 0) {
      lines.push('No meeting hours are required yet.');
    } else {
      const percentage = (hours.meeting / expected) * 100;
      const remaining = Math.max(0, expected - hours.meeting);

      const goalName = requirements.track === 'leadership' ? 'Student Leader' : 'Student';

      lines.push(
        `**Expected hours to date:** ${formatHours(expected)}`,
        `**Requirement:** ${goalName}`,
        `**Progress:** ${percentage.toFixed(1)}%`,
      );

      if (remaining === 0) {
        lines.push('✅ You have met your attendance goal to date.');
      } else {
        lines.push(`**Hours remaining:** ${formatHours(remaining)}`);
      }
    }

    lines.push(
      '',
      '**Completed meetings**',
      `Attended: ${progress.attendedMeetings}`,
      `Excused: ${progress.excusedMeetings}`,
      `Missed: ${progress.missedMeetings}`,
      `Total: ${progress.completedMeetings}`,
    );
  } else {
    lines.push('Meeting progress is not available yet.');
  }

  const hasOpenSession = recentActivity.some((record) => record.checkedOutAt === null);

  lines.push(
    '',
    hasOpenSession
      ? '**Recent attendance:** You have a session without a sign-out.'
      : '**Recent attendance:** No open session found in recent activity.',
    '',
    'Use the Basecamp dashboard to view your attendance history.',
  );

  return lines.join('\n');
}

export function formatAttendanceLeaderboard(leaderboard: AttendanceLeaderboard): string {
  if (!leaderboard.season) {
    return 'There is no active season to display rankings for.';
  }

  if (leaderboard.entries.length === 0) {
    return `No completed student meeting hours have been recorded for ${safeDisplayName(leaderboard.season.name)}.`;
  }

  const lines = [
    '🏆 **Attendance Leaderboard**',
    `Season: ${safeDisplayName(leaderboard.season.name)}`,
    '',
  ];

  for (const entry of leaderboard.entries.slice(0, 5)) {
    const name = safeDisplayName(entry.name) || 'Unknown member';

    lines.push(`**${entry.rank}.** ${name} — ${formatHours(entry.hours)}`);
  }

  lines.push(
    '',
    'Rankings are based on credited current-season meeting hours.',
    'Only active students and Student Leaders are included.',
  );

  return lines.join('\n');
}
