import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../database/database.service.js';
import { attendanceAudit } from '../database/schema/attendance.js';
import {
  AttendanceCreate,
  AttendanceRepository,
  AttendanceUpdate,
  getRequirementStatus,
} from './attendance.repository.js';

const studentId = 'S'.repeat(32);

describe('AttendanceRepository', () => {
  let repository: AttendanceRepository;
  let mockDb: any;
  let mockTx: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockTx = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      returning: vi.fn(),
      execute: vi.fn().mockResolvedValue(undefined),
    };

    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn(),
      transaction: vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback(mockTx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceRepository,
        {
          provide: DatabaseService,
          useValue: { db: mockDb },
        },
      ],
    }).compile();

    repository = module.get<AttendanceRepository>(AttendanceRepository);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('getLast', () => {
    it('returns the last attendance record for a user', async () => {
      const mockAttendance = {
        id: 1,
        user_id: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        checked_in_at: new Date('2026-10-31T14:00:00Z'),
        checked_out_at: new Date('2026-10-31T17:00:00Z'),
        category: 'meeting',
        event_id: null,
      };

      mockDb.limit.mockResolvedValueOnce([mockAttendance]);

      const result = await repository.getLast('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual({
        id: 1,
        userId: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        checkedInAt: '2026-10-31T14:00:00.000Z',
        checkedOutAt: '2026-10-31T17:00:00.000Z',
        category: 'meeting',
        eventId: null,
      });
    });

    it('returns null when there are no rows for the user', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await repository.getLast('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual(null);
    });

    it('returns an error when the row fails schema validation', async () => {
      mockDb.limit.mockResolvedValueOnce([
        {
          id: 1,
          user_id: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          checked_in_at: new Date('2026-10-31T14:00:00Z'),
          checked_out_at: null,
          category: 'invalid-category',
          event_id: null,
        },
      ]);

      const result = await repository.getLast('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');

      expect(result.isErr()).toBe(true);
    });
  });

  describe('createRecord', () => {
    it('writes a mentor sign-in audit in the same transaction as the record', async () => {
      const checkedInAt = new Date('2026-10-31T14:00:00Z');
      const created = {
        id: 9,
        user_id: studentId,
        checked_in_at: checkedInAt,
        checked_out_at: null,
        category: 'meeting',
        event_id: null,
        status: 'normal',
      };
      mockTx.limit.mockResolvedValueOnce([]);
      mockTx.returning.mockResolvedValueOnce([created]);

      const result = await repository.createRecord(
        { userId: studentId, checkedInAt, category: 'meeting', eventId: null },
        {
          actorUserId: 'mentor-1',
          action: 'mentor_signed_in',
          reason: 'Mentor-assisted attendance command',
        },
      );

      expect(result.isOk()).toBe(true);
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.insert).toHaveBeenCalledWith(attendanceAudit);
      expect(mockTx.values).toHaveBeenCalledWith({
        attendance_id: 9,
        actor_user_id: 'mentor-1',
        subject_user_id: studentId,
        action: 'mentor_signed_in',
        before: null,
        after: {
          userId: studentId,
          checkedInAt: checkedInAt.toISOString(),
          checkedOutAt: null,
          category: 'meeting',
          eventId: null,
          status: 'normal',
        },
        reason: 'Mentor-assisted attendance command',
      });
    });

    it('fails the transaction when the mentor audit insert fails', async () => {
      const checkedInAt = new Date('2026-10-31T14:00:00Z');
      mockTx.limit.mockResolvedValueOnce([]);
      mockTx.returning.mockResolvedValueOnce([
        {
          id: 9,
          user_id: studentId,
          checked_in_at: checkedInAt,
          checked_out_at: null,
          category: 'meeting',
          event_id: null,
          status: 'normal',
        },
      ]);
      mockTx.values
        .mockReturnValueOnce(mockTx)
        .mockRejectedValueOnce(new Error('Audit unavailable'));

      const result = await repository.createRecord(
        { userId: studentId, checkedInAt, category: 'meeting', eventId: null },
        {
          actorUserId: 'mentor-1',
          action: 'mentor_signed_in',
          reason: 'Mentor-assisted attendance command',
        },
      );

      expect(result._unsafeUnwrapErr().message).toBe('Audit unavailable');
    });
    it('creates and returns a record when no open session exists', async () => {
      const record: AttendanceCreate = {
        userId: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        checkedInAt: new Date('2026-10-31T14:00:00Z'),
        category: 'meeting',
        eventId: null,
      };

      mockTx.limit.mockResolvedValueOnce([]);
      mockTx.returning.mockResolvedValueOnce([
        {
          id: 1,
          user_id: record.userId,
          checked_in_at: record.checkedInAt,
          checked_out_at: null,
          category: record.category,
          event_id: null,
        },
      ]);

      const result = await repository.createRecord(record);

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual({
        id: 1,
        userId: record.userId,
        checkedInAt: '2026-10-31T14:00:00.000Z',
        checkedOutAt: null,
        category: 'meeting',
        eventId: null,
      });
    });

    it('errors when an open session already exists', async () => {
      const record: AttendanceCreate = {
        userId: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        checkedInAt: new Date('2026-10-31T14:00:00Z'),
        category: 'meeting',
        eventId: null,
      };

      mockTx.limit.mockResolvedValueOnce([{ checked_out_at: null }]);

      const result = await repository.createRecord(record);

      expect(result.isErr()).toBe(true);
    });

    it('errors when no row is returned from the insert', async () => {
      const record: AttendanceCreate = {
        userId: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        checkedInAt: new Date('2026-10-31T14:00:00Z'),
        category: 'meeting',
        eventId: null,
      };

      mockTx.limit.mockResolvedValueOnce([]);
      mockTx.returning.mockResolvedValueOnce([]);

      const result = await repository.createRecord(record);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(Error);
    });

    it('inserts using snake_case column names', async () => {
      const record: AttendanceCreate = {
        userId: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        checkedInAt: new Date('2026-10-31T14:00:00Z'),
        category: 'meeting',
        eventId: null,
      };

      mockTx.limit.mockResolvedValueOnce([]);
      mockTx.returning.mockResolvedValueOnce([
        {
          id: 1,
          user_id: record.userId,
          checked_in_at: record.checkedInAt,
          checked_out_at: null,
          category: record.category,
          event_id: null,
        },
      ]);

      await repository.createRecord(record);

      expect(mockTx.values).toHaveBeenCalledWith({
        user_id: record.userId,
        checked_in_at: record.checkedInAt,
        checked_out_at: null,
        category: 'meeting',
        event_id: null,
      });
    });
  });

  describe('updateLast', () => {
    it('stores the before and after state for a mentor sign-out', async () => {
      const checkedInAt = new Date('2026-10-31T14:00:00Z');
      const checkedOutAt = new Date('2026-10-31T17:00:00Z');
      const before = {
        id: 9,
        user_id: studentId,
        checked_in_at: checkedInAt,
        checked_out_at: null,
        category: 'meeting',
        event_id: null,
        status: 'normal',
      };
      mockTx.limit.mockResolvedValueOnce([before]);
      mockTx.returning.mockResolvedValueOnce([{ ...before, checked_out_at: checkedOutAt }]);

      const result = await repository.updateLast(
        studentId,
        { checkedOutAt },
        {
          actorUserId: 'mentor-1',
          action: 'mentor_signed_out',
          reason: 'Mentor-assisted attendance command',
        },
      );

      expect(result.isOk()).toBe(true);
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.insert).toHaveBeenCalledWith(attendanceAudit);
      expect(mockTx.values).toHaveBeenCalledWith(
        expect.objectContaining({
          attendance_id: 9,
          actor_user_id: 'mentor-1',
          subject_user_id: studentId,
          action: 'mentor_signed_out',
          before: expect.objectContaining({ checkedOutAt: null }),
          after: expect.objectContaining({ checkedOutAt: checkedOutAt.toISOString() }),
        }),
      );
    });

    it('fails a mentor sign-out when its audit cannot be stored', async () => {
      const checkedInAt = new Date('2026-10-31T14:00:00Z');
      const before = {
        id: 9,
        user_id: studentId,
        checked_in_at: checkedInAt,
        checked_out_at: null,
        category: 'meeting',
        event_id: null,
        status: 'normal',
      };
      mockTx.limit.mockResolvedValueOnce([before]);
      mockTx.returning.mockResolvedValueOnce([
        { ...before, checked_out_at: new Date('2026-10-31T17:00:00Z') },
      ]);
      mockTx.values.mockRejectedValueOnce(new Error('Audit unavailable'));

      const result = await repository.updateLast(
        studentId,
        { checkedOutAt: new Date('2026-10-31T17:00:00Z') },
        {
          actorUserId: 'mentor-1',
          action: 'mentor_signed_out',
          reason: 'Mentor-assisted attendance command',
        },
      );

      expect(result._unsafeUnwrapErr().message).toBe('Audit unavailable');
    });
    it('updates the last attendance record for a user', async () => {
      const updates: AttendanceUpdate = {
        checkedOutAt: new Date('2026-10-31T17:00:00Z'),
        category: 'outreach',
        eventId: 123,
      };

      mockTx.limit.mockResolvedValueOnce([{ id: 1 }]);
      mockTx.returning.mockResolvedValueOnce([
        {
          id: 1,
          user_id: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          checked_in_at: new Date('2026-10-31T14:00:00Z'),
          checked_out_at: new Date('2026-10-31T17:00:00Z'),
          category: 'outreach',
          event_id: 123,
        },
      ]);

      const result = await repository.updateLast('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', updates);

      expect(mockTx.set).toHaveBeenCalledWith({
        checked_out_at: updates.checkedOutAt,
        category: 'outreach',
        event_id: 123,
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual({
        id: 1,
        userId: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        checkedInAt: '2026-10-31T14:00:00.000Z',
        checkedOutAt: '2026-10-31T17:00:00.000Z',
        category: 'outreach',
        eventId: 123,
      });
    });

    it('only sets fields included in the update', async () => {
      const updates: AttendanceUpdate = {
        checkedOutAt: new Date('2026-10-31T17:00:00Z'),
      };

      mockTx.limit.mockResolvedValueOnce([{ id: 1 }]);
      mockTx.returning.mockResolvedValueOnce([
        {
          id: 1,
          user_id: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          checked_in_at: new Date('2026-10-31T14:00:00Z'),
          checked_out_at: new Date('2026-10-31T17:00:00Z'),
          category: 'meeting',
          event_id: null,
        },
      ]);

      const result = await repository.updateLast('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', updates);

      expect(mockTx.set).toHaveBeenCalledWith({
        checked_out_at: updates.checkedOutAt,
      });
      expect(result.isOk()).toBe(true);
    });

    it('errors when no row ID is found', async () => {
      mockTx.limit.mockResolvedValueOnce([]);

      const result = await repository.updateLast('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', {
        checkedOutAt: new Date('2026-10-31T17:00:00Z'),
      });

      expect(result.isErr()).toBe(true);
    });

    it('errors when no row is returned from the update', async () => {
      mockTx.limit.mockResolvedValueOnce([{ id: 1 }]);
      mockTx.returning.mockResolvedValueOnce([]);

      const result = await repository.updateLast('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', {
        checkedOutAt: new Date('2026-10-31T17:00:00Z'),
      });

      expect(result.isErr()).toBe(true);
    });
  });

  describe('getUserIdByDiscordId', () => {
    it('returns the user ID for a Discord ID', async () => {
      const userId = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
      mockDb.limit.mockResolvedValueOnce([{ userId }]);

      const result = await repository.getUserIdByDiscordId('123456789012345678');

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBe(userId);
    });

    it('errors when no linked account is found', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await repository.getUserIdByDiscordId('123456789012345678');

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(Error);
    });
  });
});

describe('getRequirementStatus', () => {
  it('uses rookie experience even when legacy status says veteran', () => {
    expect(
      getRequirementStatus({
        role: 'student',
        student_experience: 'rookie',
        legacy_status: 'veteran',
      }),
    ).toBe('rookie');
  });

  it('uses veteran experience even when legacy status says rookie', () => {
    expect(
      getRequirementStatus({
        role: 'student_leader',
        student_experience: 'veteran',
        legacy_status: 'rookie',
      }),
    ).toBe('veteran');
  });

  it('uses mentor status for mentors despite a legacy student status', () => {
    expect(
      getRequirementStatus({
        role: 'mentor',
        student_experience: null,
        legacy_status: 'rookie',
      }),
    ).toBe('mentor');
  });

  it('uses mentor status for team admins despite a legacy student status', () => {
    expect(
      getRequirementStatus({
        role: 'team_admin',
        student_experience: null,
        legacy_status: 'veteran',
      }),
    ).toBe('mentor');
  });
});
