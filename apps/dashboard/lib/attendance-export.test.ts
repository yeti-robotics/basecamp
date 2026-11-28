import { createAttendanceCsv } from './attendance-export';
import type { AttendanceRecord } from './attendance-records';

// Sample attendance record used throughout the tests.
const record: AttendanceRecord = {
  id: 1,
  userId: 'student-1',
  memberName: 'Ada Lovelace',
  memberImage: null,
  eventId: 3,
  eventName: 'Build meeting',
  category: 'meeting',
  status: 'normal',
  checkedInAt: '2026-11-05T21:30:00.000Z',
  checkedOutAt: '2026-11-05T23:45:00.000Z',
  hours: 2.25,
  edited: false,
};

describe('createAttendanceCsv', () => {
  it('includes all expected column headers', () => {
    expect(createAttendanceCsv([])).toBe(
      '"Member","Event","Category","Status","Check In (UTC)","Check Out (UTC)","Recorded Hours","Session Open","Edited"',
    );
  });

  it('exports completed attendance records', () => {
    const csv = createAttendanceCsv([record]);

    expect(csv).toContain(
      '"Ada Lovelace","Build meeting","meeting","normal","2026-11-05T21:30:00.000Z","2026-11-05T23:45:00.000Z","2.25","No","No"',
    );
  });

  it('exports multiple attendance records', () => {
    const secondRecord: AttendanceRecord = {
      ...record,
      id: 2,
      memberName: 'Grace Hopper',
      userId: 'student-2',
    };

    const csv = createAttendanceCsv([record, secondRecord]);

    expect(csv).toContain('Ada Lovelace');
    expect(csv).toContain('Grace Hopper');
    expect(csv.split('\r\n')).toHaveLength(3);
  });

  it('identifies open attendance sessions', () => {
    const csv = createAttendanceCsv([
      {
        ...record,
        checkedOutAt: null,
        hours: 0,
      },
    ]);

    expect(csv).toContain('"","0","Yes","No"');
  });

  it('includes manually created attendance records', () => {
    const csv = createAttendanceCsv([
      {
        ...record,
        status: 'manual',
      },
    ]);

    expect(csv).toContain('"meeting","manual"');
  });

  it('includes excused attendance records', () => {
    const csv = createAttendanceCsv([
      {
        ...record,
        status: 'excused',
        hours: 4,
      },
    ]);

    expect(csv).toContain('"meeting","excused"');
    expect(csv).toContain('"4","No","No"');
  });

  it('includes outreach attendance records', () => {
    const csv = createAttendanceCsv([
      {
        ...record,
        category: 'outreach',
        eventName: 'Community outreach',
      },
    ]);

    expect(csv).toContain('"Community outreach","outreach"');
  });

  it('identifies edited attendance records', () => {
    const csv = createAttendanceCsv([
      {
        ...record,
        edited: true,
      },
    ]);

    expect(csv).toContain('"2.25","No","Yes"');
  });

  it('handles missing member and event names', () => {
    const csv = createAttendanceCsv([
      {
        ...record,
        memberName: null,
        eventName: null,
      },
    ]);

    expect(csv).toContain('"","","meeting","normal"');
  });

  it('preserves UTC timestamps', () => {
    const csv = createAttendanceCsv([record]);

    expect(csv).toContain('"2026-11-05T21:30:00.000Z"');
    expect(csv).toContain('"2026-11-05T23:45:00.000Z"');
  });

  it('does not expose internal user identifiers or profile images', () => {
    const csv = createAttendanceCsv([
      {
        ...record,
        memberImage: 'https://example.com/avatar.png',
      },
    ]);

    expect(csv).not.toContain(record.userId);
    expect(csv).not.toContain('https://example.com/avatar.png');
    expect(csv).not.toContain('User ID');
    expect(csv).not.toContain('Event ID');
    expect(csv).not.toContain('Audit Reason');
  });

  it('neutralizes spreadsheet formulas in member names', () => {
    const csv = createAttendanceCsv([
      {
        ...record,
        memberName: '=1+1',
      },
    ]);

    expect(csv).toContain(`"'=1+1"`);
  });

  it('neutralizes spreadsheet formulas in event names', () => {
    const csv = createAttendanceCsv([
      {
        ...record,
        eventName: '@SUM(A1:A2)',
      },
    ]);

    expect(csv).toContain(`"'@SUM(A1:A2)"`);
  });

  it('escapes commas and quotation marks in event names', () => {
    const csv = createAttendanceCsv([
      {
        ...record,
        eventName: 'Build meeting, "Saturday"',
      },
    ]);

    expect(csv).toContain('"Build meeting, ""Saturday"""');
  });

  it('supports readonly attendance arrays', () => {
    const records = [record] as const;

    expect(createAttendanceCsv(records)).toContain('"Ada Lovelace"');
  });

  it('preserves the original attendance records', () => {
    const original = { ...record };
    const records = [original];

    createAttendanceCsv(records);

    expect(records).toEqual([record]);
  });

  it('returns only headers when no records are supplied', () => {
    expect(createAttendanceCsv([]).split('\r\n')).toHaveLength(1);
  });
});
