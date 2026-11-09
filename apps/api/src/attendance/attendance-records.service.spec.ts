import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AttendanceRecordsService, RECORD_LIST_LIMIT } from './attendance-records.service.js';

function selectQuery(rows: unknown[]) {
  const builder = {
    from: vi.fn(() => builder),
    leftJoin: vi.fn(() => builder),
    where: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    limit: vi.fn().mockResolvedValue(rows),
  };
  return builder;
}

function historyQuery(rows: unknown[]) {
  const builder = {
    from: vi.fn(() => builder),
    leftJoin: vi.fn(() => builder),
    where: vi.fn(() => builder),
    orderBy: vi.fn().mockResolvedValue(rows),
  };
  return builder;
}

function insertQuery(rows: unknown[] = []) {
  const builder = {
    values: vi.fn(() => builder),
    returning: vi.fn().mockResolvedValue(rows),
  };
  return builder;
}

function updateQuery(rows: unknown[]) {
  const builder = {
    set: vi.fn(() => builder),
    where: vi.fn(() => builder),
    returning: vi.fn().mockResolvedValue(rows),
  };
  return builder;
}

const database = { select: vi.fn(), transaction: vi.fn() };
const tx = { select: vi.fn(), insert: vi.fn(), update: vi.fn() };
const authorization = { canManageAttendance: vi.fn() };

const storedRow = {
  id: 7,
  user_id: 'student-1',
  event_id: null,
  checked_in_at: new Date('2026-11-05T21:30:00.000Z'),
  checked_out_at: null,
  category: 'meeting' as const,
  status: 'normal' as const,
};

const record = {
  id: 7,
  userId: 'student-1',
  memberName: 'Ada Lovelace',
  memberImage: null,
  eventId: null,
  eventName: null,
  category: 'meeting',
  status: 'normal',
  checkedInAt: new Date('2026-11-05T21:30:00.000Z'),
  checkedOutAt: new Date('2026-11-05T23:45:00.000Z'),
  edited: true,
};

const input = {
  userId: ' student-1 ',
  checkedInAt: '2026-11-07T14:00:00.000Z',
  checkedOutAt: '2026-11-07T18:00:00.000Z',
  category: 'meeting' as const,
  status: 'excused' as const,
  reason: '  Robotics competition ',
};

function makeService() {
  return new AttendanceRecordsService({ db: database } as never, authorization as never);
}

describe('AttendanceRecordsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorization.canManageAttendance.mockResolvedValue(true);
    database.transaction.mockImplementation(async (callback: (t: typeof tx) => unknown) =>
      callback(tx),
    );
  });

  describe('list', () => {
    it('is limited to mentors and Team Admins', async () => {
      authorization.canManageAttendance.mockResolvedValue(false);

      await expect(makeService().list('student-1')).rejects.toBeInstanceOf(ForbiddenException);
      expect(authorization.canManageAttendance).toHaveBeenCalledWith('student-1');
      expect(database.select).not.toHaveBeenCalled();
    });

    it('returns records with completed hours, newest first', async () => {
      const query = selectQuery([record, { ...record, id: 8, checkedOutAt: null, edited: false }]);
      database.select.mockReturnValueOnce(query);

      await expect(makeService().list('mentor', { q: ' ada ' })).resolves.toEqual({
        records: [
          { ...record, hours: 2.25 },
          { ...record, id: 8, checkedOutAt: null, edited: false, hours: 0 },
        ],
        truncated: false,
      });
      expect(query.leftJoin).toHaveBeenCalledTimes(2);
      expect(query.limit).toHaveBeenCalledWith(RECORD_LIST_LIMIT + 1);
    });

    it('reports when more records match than the page shows', async () => {
      database.select.mockReturnValueOnce(
        selectQuery(Array.from({ length: RECORD_LIST_LIMIT + 1 }, (_, id) => ({ ...record, id }))),
      );

      const result = await makeService().list('mentor');
      expect(result.records).toHaveLength(RECORD_LIST_LIMIT);
      expect(result.truncated).toBe(true);
    });

    it.each([
      ['an invalid from date', { from: 'yesterday' }, 'From must be a valid timestamp'],
      [
        'a range that ends before it starts',
        { from: '2026-11-07T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' },
        'To must be on or after From',
      ],
      ['an unknown status', { status: 'deleted' }, 'Choose a valid status'],
      ['a non-text search', { q: ['ada'] }, 'Search must be text'],
    ])('rejects %s', async (_case, filter, message) => {
      await expect(makeService().list('mentor', filter as never)).rejects.toThrow(message);
      expect(database.select).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('is limited to mentors and Team Admins', async () => {
      authorization.canManageAttendance.mockResolvedValue(false);

      await expect(makeService().create('student-1', input)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(database.transaction).not.toHaveBeenCalled();
    });

    it.each([
      ['missing details', null, 'Attendance details are required'],
      ['a missing member', { ...input, userId: '' }, 'Member is required'],
      ['a missing end time', { ...input, checkedOutAt: undefined }, 'End time is required'],
      ['an invalid start time', { ...input, checkedInAt: 'soon' }, 'Start time must be a valid'],
      [
        'an end before the start',
        { ...input, checkedOutAt: input.checkedInAt },
        'End time must be after start time',
      ],
      ['an unknown category', { ...input, category: 'party' }, 'Choose a valid category'],
      ['an invalid event', { ...input, eventId: 0 }, 'Choose a valid event'],
      ['the sign-in status', { ...input, status: 'normal' }, 'Status must be manual or excused'],
      ['a blank reason', { ...input, reason: '  ' }, 'Reason is required'],
      ['an overlong reason', { ...input, reason: 'x'.repeat(501) }, 'Reason must be 500'],
    ])('rejects %s', async (_case, body, message) => {
      const result = makeService().create('mentor', body as never);

      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      await expect(result).rejects.toThrow(message);
      expect(database.transaction).not.toHaveBeenCalled();
    });

    it('rejects a member that does not exist', async () => {
      tx.select.mockReturnValueOnce(selectQuery([]));

      await expect(makeService().create('mentor', input)).rejects.toBeInstanceOf(NotFoundException);
      expect(tx.insert).not.toHaveBeenCalled();
    });

    it('rejects an event that does not exist', async () => {
      tx.select.mockReturnValueOnce(selectQuery([{ id: 'student-1' }]));
      tx.select.mockReturnValueOnce(selectQuery([]));

      await expect(makeService().create('mentor', { ...input, eventId: 3 })).rejects.toThrow(
        'Event not found',
      );
      expect(tx.insert).not.toHaveBeenCalled();
    });

    it('stores the record with its status and an audit entry with the reason', async () => {
      const created = {
        ...storedRow,
        id: 9,
        checked_in_at: new Date(input.checkedInAt),
        checked_out_at: new Date(input.checkedOutAt),
        status: 'excused' as const,
      };
      const recordInsert = insertQuery([created]);
      const auditInsert = insertQuery();
      tx.select.mockReturnValueOnce(selectQuery([{ id: 'student-1' }]));
      tx.insert.mockReturnValueOnce(recordInsert).mockReturnValueOnce(auditInsert);
      database.select.mockReturnValueOnce(selectQuery([{ ...record, id: 9, status: 'excused' }]));

      await expect(makeService().create('mentor', input)).resolves.toMatchObject({
        id: 9,
        status: 'excused',
      });
      expect(recordInsert.values).toHaveBeenCalledWith({
        user_id: 'student-1',
        checked_in_at: new Date(input.checkedInAt),
        checked_out_at: new Date(input.checkedOutAt),
        category: 'meeting',
        event_id: null,
        status: 'excused',
      });
      expect(auditInsert.values).toHaveBeenCalledWith({
        attendance_id: 9,
        actor_user_id: 'mentor',
        subject_user_id: 'student-1',
        action: 'record_created',
        before: null,
        after: {
          userId: 'student-1',
          checkedInAt: input.checkedInAt,
          checkedOutAt: input.checkedOutAt,
          category: 'meeting',
          eventId: null,
          status: 'excused',
        },
        reason: 'Robotics competition',
      });
    });

    it('fails loudly when the insert does not return a row', async () => {
      tx.select.mockReturnValueOnce(selectQuery([{ id: 'student-1' }]));
      tx.insert.mockReturnValueOnce(insertQuery([]));

      await expect(makeService().create('mentor', input)).rejects.toThrow(
        'Attendance insert did not return a row',
      );
    });
  });

  describe('update', () => {
    it('requires a reason before touching the database', async () => {
      await expect(
        makeService().update('mentor', 7, { checkedOutAt: '2026-11-05T23:45:00.000Z' } as never),
      ).rejects.toThrow('Reason is required');
      expect(database.transaction).not.toHaveBeenCalled();
    });

    it('rejects missing changes', async () => {
      await expect(makeService().update('mentor', 7, null as never)).rejects.toThrow(
        'Attendance changes are required',
      );
      tx.select.mockReturnValueOnce(selectQuery([storedRow]));
      await expect(makeService().update('mentor', 7, { reason: 'Nothing' })).rejects.toThrow(
        'Attendance changes are required',
      );
    });

    it('returns not found for an unknown record', async () => {
      tx.select.mockReturnValueOnce(selectQuery([]));

      await expect(
        makeService().update('mentor', 99, { status: 'excused', reason: 'Sick' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(tx.update).not.toHaveBeenCalled();
    });

    it('checks a new end time against the stored start time', async () => {
      tx.select.mockReturnValueOnce(selectQuery([storedRow]));

      await expect(
        makeService().update('mentor', 7, {
          checkedOutAt: '2026-11-05T20:00:00.000Z',
          reason: 'Wrong time',
        }),
      ).rejects.toThrow('End time must be after start time');
      expect(tx.update).not.toHaveBeenCalled();
    });

    it('does not let mentors mark a record as a normal sign-in', async () => {
      tx.select.mockReturnValueOnce(selectQuery([{ ...storedRow, status: 'manual' }]));

      await expect(
        makeService().update('mentor', 7, { status: 'normal' as never, reason: 'Undo' }),
      ).rejects.toThrow('Status must be manual or excused');
    });

    it('rejects moving the record to an event that does not exist', async () => {
      tx.select.mockReturnValueOnce(selectQuery([storedRow])).mockReturnValueOnce(selectQuery([]));

      await expect(
        makeService().update('mentor', 7, { eventId: 3, reason: 'Linked event' }),
      ).rejects.toThrow('Event not found');
      expect(tx.update).not.toHaveBeenCalled();
    });

    it('writes the changes and records before and after values with the reason', async () => {
      const after = {
        ...storedRow,
        checked_out_at: new Date('2026-11-05T23:45:00.000Z'),
        category: 'outreach' as const,
        event_id: 3,
        status: 'excused' as const,
      };
      const update = updateQuery([after]);
      const auditInsert = insertQuery();
      tx.select
        .mockReturnValueOnce(selectQuery([storedRow]))
        .mockReturnValueOnce(selectQuery([{ id: 3 }]));
      tx.update.mockReturnValueOnce(update);
      tx.insert.mockReturnValueOnce(auditInsert);
      database.select.mockReturnValueOnce(selectQuery([record]));

      await expect(
        makeService().update('mentor', 7, {
          checkedOutAt: '2026-11-05T23:45:00.000Z',
          category: 'outreach',
          eventId: 3,
          status: 'excused',
          reason: ' Forgot to sign out ',
        }),
      ).resolves.toEqual({ ...record, hours: 2.25 });
      expect(update.set).toHaveBeenCalledWith({
        checked_out_at: new Date('2026-11-05T23:45:00.000Z'),
        category: 'outreach',
        event_id: 3,
        status: 'excused',
      });
      expect(auditInsert.values).toHaveBeenCalledWith(
        expect.objectContaining({
          attendance_id: 7,
          actor_user_id: 'mentor',
          subject_user_id: 'student-1',
          action: 'record_updated',
          before: expect.objectContaining({ checkedOutAt: null, status: 'normal' }),
          after: expect.objectContaining({
            checkedOutAt: '2026-11-05T23:45:00.000Z',
            status: 'excused',
            eventId: 3,
          }),
          reason: 'Forgot to sign out',
        }),
      );
    });

    it('can change the start time on its own', async () => {
      const update = updateQuery([
        { ...storedRow, checked_in_at: new Date('2026-11-05T21:00:00Z') },
      ]);
      tx.select.mockReturnValueOnce(selectQuery([storedRow]));
      tx.update.mockReturnValueOnce(update);
      tx.insert.mockReturnValueOnce(insertQuery());
      database.select.mockReturnValueOnce(selectQuery([record]));

      await makeService().update('mentor', 7, {
        checkedInAt: '2026-11-05T21:00:00.000Z',
        eventId: null,
        reason: 'Arrived early',
      });
      expect(update.set).toHaveBeenCalledWith({
        checked_in_at: new Date('2026-11-05T21:00:00.000Z'),
        event_id: null,
      });
    });
  });

  describe('history', () => {
    it('is limited to mentors and Team Admins', async () => {
      authorization.canManageAttendance.mockResolvedValue(false);

      await expect(makeService().history('student-1', 7)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('returns not found for an unknown record', async () => {
      database.select.mockReturnValueOnce(selectQuery([]));

      await expect(makeService().history('mentor', 99)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns the audit entries for the record', async () => {
      const entries = [{ id: 1, action: 'record_updated', actorName: 'Mia', reason: 'Sick' }];
      const query = historyQuery(entries);
      database.select.mockReturnValueOnce(selectQuery([{ id: 7 }])).mockReturnValueOnce(query);

      await expect(makeService().history('mentor', 7)).resolves.toEqual(entries);
      expect(query.leftJoin).toHaveBeenCalledOnce();
    });
  });
});
