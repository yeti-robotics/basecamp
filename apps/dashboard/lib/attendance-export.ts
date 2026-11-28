import type { AttendanceRecord } from './attendance-records';
import { toCsv } from './csv';

// Convert attendance records into a spreadsheet-compatible report.
export function createAttendanceCsv(records: readonly AttendanceRecord[]): string {
  return toCsv([
    [
      'Member',
      'Event',
      'Category',
      'Status',
      'Check In (UTC)',
      'Check Out (UTC)',
      'Recorded Hours',
      'Session Open',
      'Edited',
    ],
    ...records.map((record) => [
      record.memberName ?? '',
      record.eventName ?? '',
      record.category,
      record.status,
      record.checkedInAt,
      record.checkedOutAt ?? '',
      record.hours,
      record.checkedOutAt === null ? 'Yes' : 'No',
      record.edited ? 'Yes' : 'No',
    ]),
  ]);
}
