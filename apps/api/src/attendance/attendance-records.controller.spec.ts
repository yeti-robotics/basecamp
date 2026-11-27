import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AttendanceRecordsController } from './attendance-records.controller.js';

// Mock the service so controller tests do not require a database.
const records = {
  list: vi.fn(),
  exportRecords: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  history: vi.fn(),
};

const request = { authUserId: 'mentor-1' } as never;
const anonymousRequest = {} as never;

const record = {
  id: 7,
  userId: 'student-1',
  memberName: 'Ada Lovelace',
  checkedInAt: '2026-11-07T14:00:00.000Z',
  checkedOutAt: '2026-11-07T18:00:00.000Z',
  status: 'excused',
};

function makeController() {
  return new AttendanceRecordsController(records as never);
}

describe('AttendanceRecordsController', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('passes the signed-in mentor and filters into the record list', async () => {
    const result = { records: [record], truncated: false };
    records.list.mockResolvedValue(result);

    await expect(
      makeController().list(request, {
        q: 'ada',
        status: 'excused',
      }),
    ).resolves.toEqual(result);

    expect(records.list).toHaveBeenCalledWith('mentor-1', {
      q: 'ada',
      status: 'excused',
    });
  });

  describe('exportRecords', () => {
    it('passes the authenticated user and all filters into the export', async () => {
      const filter = {
        q: 'ada',
        from: '2026-11-01T00:00:00.000Z',
        to: '2026-11-30T23:59:59.999Z',
        status: 'excused',
      };

      records.exportRecords.mockResolvedValue([record]);

      await expect(makeController().exportRecords(request, filter)).resolves.toEqual([record]);

      expect(records.exportRecords).toHaveBeenCalledWith('mentor-1', filter);

      expect(records.exportRecords).toHaveBeenCalledTimes(1);
      expect(records.list).not.toHaveBeenCalled();
    });

    it('supports exporting without filters', async () => {
      records.exportRecords.mockResolvedValue([record]);

      await expect(makeController().exportRecords(request, {})).resolves.toEqual([record]);

      expect(records.exportRecords).toHaveBeenCalledWith('mentor-1', {});
    });

    it('returns an empty array when no records match', async () => {
      records.exportRecords.mockResolvedValue([]);

      await expect(
        makeController().exportRecords(request, {
          q: 'Nobody',
        }),
      ).resolves.toEqual([]);
    });

    it('rejects exports without an authenticated user', async () => {
      await expect(makeController().exportRecords(anonymousRequest, {})).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(records.exportRecords).not.toHaveBeenCalled();
    });

    it('propagates service authorization errors', async () => {
      const studentRequest = {
        authUserId: 'student-1',
      } as never;

      records.exportRecords.mockRejectedValue(
        new ForbiddenException('Only active mentors and Team Admins can manage attendance'),
      );

      await expect(makeController().exportRecords(studentRequest, {})).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      expect(records.exportRecords).toHaveBeenCalledWith('student-1', {});
    });

    it('propagates errors when an export exceeds the supported limit', async () => {
      records.exportRecords.mockRejectedValue(
        new BadRequestException('Too many records to export. Narrow the date range and try again.'),
      );

      await expect(makeController().exportRecords(request, {})).rejects.toThrow(
        'Too many records to export. Narrow the date range and try again.',
      );
    });

    it('propagates invalid filter errors from the service', async () => {
      records.exportRecords.mockRejectedValue(
        new BadRequestException('To must be on or after From'),
      );

      await expect(
        makeController().exportRecords(request, {
          from: '2026-11-30T00:00:00.000Z',
          to: '2026-11-01T00:00:00.000Z',
        }),
      ).rejects.toThrow('To must be on or after From');
    });
  });

  it('passes the signed-in mentor into create, update, and history actions', async () => {
    const input = {
      userId: 'student-1',
      checkedInAt: record.checkedInAt,
      checkedOutAt: record.checkedOutAt,
      category: 'meeting' as const,
      status: 'excused' as const,
      reason: 'Robotics competition',
    };

    records.create.mockResolvedValue(record);
    records.update.mockResolvedValue(record);
    records.history.mockResolvedValue([]);

    await expect(makeController().create(request, input)).resolves.toEqual(record);

    await expect(
      makeController().update(request, 7, {
        status: 'excused',
        reason: 'Sick',
      }),
    ).resolves.toEqual(record);

    await expect(makeController().history(request, 7)).resolves.toEqual([]);

    expect(records.create).toHaveBeenCalledWith('mentor-1', input);

    expect(records.update).toHaveBeenCalledWith('mentor-1', 7, {
      status: 'excused',
      reason: 'Sick',
    });

    expect(records.history).toHaveBeenCalledWith('mentor-1', 7);
  });

  it('rejects requests when the session guard did not attach a user', async () => {
    await expect(makeController().list(anonymousRequest, {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(records.list).not.toHaveBeenCalled();
  });
});
