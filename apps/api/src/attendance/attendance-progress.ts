import { EXPIRED_SESSION_THRESHOLD_MS, MS_PER_HOUR } from './attendance.constants.js';

/** A non-cancelled event in the season that counts toward meeting hours. */
export interface ProgressMeeting {
  id: number;
  startsAt: Date;
  endsAt: Date;
}

export interface ProgressRecord {
  eventId: number | null;
  category: 'meeting' | 'outreach';
  status: 'normal' | 'manual' | 'excused';
  checkedInAt: Date;
  checkedOutAt: Date | null;
}

export interface MeetingRequirements {
  member: number | null;
  leadership: number | null;
}

export interface MeetingProgress {
  completedMeetings: number;
  attendedMeetings: number;
  excusedMeetings: number;
  missedMeetings: number;
  completedMeetingHours: number;
  scheduledMeetingHours: number;
  expectedHours: MeetingRequirements;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function hoursBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / MS_PER_HOUR);
}

// An open sign-in is treated as lasting until it would expire, so a forgotten sign-out
// still counts for the meeting it started in but not for every meeting after it.
function recordEnd(record: ProgressRecord): Date {
  return (
    record.checkedOutAt ?? new Date(record.checkedInAt.getTime() + EXPIRED_SESSION_THRESHOLD_MS)
  );
}

export function recordCoversMeeting(record: ProgressRecord, meeting: ProgressMeeting): boolean {
  if (record.eventId === meeting.id) return true;
  return record.checkedInAt < meeting.endsAt && recordEnd(record) > meeting.startsAt;
}

export type MeetingOutcome = 'attended' | 'excused' | 'missed';

export function meetingOutcome(
  meeting: ProgressMeeting,
  records: ProgressRecord[],
): MeetingOutcome {
  const covering = records.filter(
    (record) => record.category === 'meeting' && recordCoversMeeting(record, meeting),
  );
  if (covering.some((record) => record.status !== 'excused')) return 'attended';
  if (covering.length > 0) return 'excused';
  return 'missed';
}

/**
 * Compares a member's meeting attendance with the meetings completed so far this season.
 * Expected hours prorate each season requirement by the share of scheduled meeting hours
 * that have finished. Excused meetings are not counted as missed.
 */
export function calculateMeetingProgress(
  meetings: ProgressMeeting[],
  records: ProgressRecord[],
  requirements: MeetingRequirements,
  now: Date,
): MeetingProgress {
  const completed = meetings.filter((meeting) => meeting.endsAt <= now);
  const scheduledMeetingHours = meetings.reduce(
    (total, meeting) => total + hoursBetween(meeting.startsAt, meeting.endsAt),
    0,
  );
  const completedMeetingHours = completed.reduce(
    (total, meeting) => total + hoursBetween(meeting.startsAt, meeting.endsAt),
    0,
  );
  const share = scheduledMeetingHours > 0 ? completedMeetingHours / scheduledMeetingHours : 0;
  const expected = (required: number | null) =>
    required === null ? null : round2(Math.min(required, required * share));

  const outcomes = completed.map((meeting) => meetingOutcome(meeting, records));
  return {
    completedMeetings: completed.length,
    attendedMeetings: outcomes.filter((outcome) => outcome === 'attended').length,
    excusedMeetings: outcomes.filter((outcome) => outcome === 'excused').length,
    missedMeetings: outcomes.filter((outcome) => outcome === 'missed').length,
    completedMeetingHours: round2(completedMeetingHours),
    scheduledMeetingHours: round2(scheduledMeetingHours),
    expectedHours: {
      member: expected(requirements.member),
      leadership: expected(requirements.leadership),
    },
  };
}
