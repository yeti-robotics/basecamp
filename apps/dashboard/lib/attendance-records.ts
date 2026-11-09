import { headers } from 'next/headers';

const apiInternalUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:8000';
export const ATTENDANCE_TIME_ZONE = 'America/New_York';

export type AttendanceStatus = 'normal' | 'manual' | 'excused';

export interface AttendanceRecord {
  id: number;
  userId: string | null;
  memberName: string | null;
  memberImage: string | null;
  eventId: number | null;
  eventName: string | null;
  category: 'meeting' | 'outreach';
  status: AttendanceStatus;
  checkedInAt: string;
  checkedOutAt: string | null;
  hours: number;
  edited: boolean;
}

export interface AttendanceRecordList {
  records: AttendanceRecord[];
  truncated: boolean;
}

export interface AttendanceRecordSnapshot {
  userId: string | null;
  checkedInAt: string;
  checkedOutAt: string | null;
  category: AttendanceRecord['category'];
  eventId: number | null;
  status: AttendanceStatus;
}

export interface AttendanceHistoryEntry {
  id: number;
  action: 'record_created' | 'record_updated';
  actorName: string | null;
  before: AttendanceRecordSnapshot | null;
  after: AttendanceRecordSnapshot | null;
  reason: string;
  createdAt: string;
}

/** Search params the attendance page accepts; dates are YYYY-MM-DD in the team's time zone. */
export interface AttendanceRecordSearch {
  q?: string;
  from?: string;
  to?: string;
  status?: string;
}

export type AttendanceRecordsResult = AttendanceRecordList | 'forbidden' | null;

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second'),
  );
  return asUtc - instant.getTime();
}

/** The instant a local calendar day starts (or the last millisecond it covers) in a time zone. */
export function dayBoundary(day: string, edge: 'start' | 'end', timeZone = ATTENDANCE_TIME_ZONE) {
  if (!datePattern.test(day)) return null;
  const [year = Number.NaN, month = Number.NaN, date = Number.NaN] = day.split('-').map(Number);
  const localMidnight = Date.UTC(year, month - 1, edge === 'start' ? date : date + 1);
  if (Number.isNaN(localMidnight)) return null;
  const firstGuess = localMidnight - zoneOffsetMs(new Date(localMidnight), timeZone);
  const instant = localMidnight - zoneOffsetMs(new Date(firstGuess), timeZone);
  return new Date(edge === 'start' ? instant : instant - 1);
}

export function recordQuery(search: AttendanceRecordSearch): URLSearchParams {
  const query = new URLSearchParams();
  const q = search.q?.trim();
  if (q) query.set('q', q);
  const from = search.from ? dayBoundary(search.from, 'start') : null;
  if (from) query.set('from', from.toISOString());
  const to = search.to ? dayBoundary(search.to, 'end') : null;
  if (to) query.set('to', to.toISOString());
  if (search.status === 'normal' || search.status === 'manual' || search.status === 'excused') {
    query.set('status', search.status);
  }
  return query;
}

export async function getAttendanceRecords(
  search: AttendanceRecordSearch,
): Promise<AttendanceRecordsResult> {
  const cookie = (await headers()).get('cookie');
  if (!cookie) return null;

  const query = recordQuery(search).toString();
  try {
    const response = await fetch(
      `${apiInternalUrl}/api/attendance/records${query ? `?${query}` : ''}`,
      { headers: { cookie }, cache: 'no-store' },
    );
    if (response.status === 403) return 'forbidden';
    if (!response.ok) return null;
    return (await response.json()) as AttendanceRecordList;
  } catch (error) {
    console.error('Failed to load attendance records:', error);
    return null;
  }
}
