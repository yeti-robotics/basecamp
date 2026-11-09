import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AttendanceRecordsController } from './attendance-records.controller.js';

const records = {
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  history: vi.fn(),
};
const request = { authUserId: 'mentor-1' } as never;
const anonymousRequest = {} as never;

function makeController() {
  return new AttendanceRecordsController(records as never);
}

describe('AttendanceRecordsController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes the signed-in mentor and filters into the record list', async () => {
    const result = { records: [record], truncated: false };
    records.list.mockResolvedValue(result);

    await expect(makeController().list(request, { q: 'ada', status: 'excused' })).resolves.toEqual(
      result,
    );
    expect(records.list).toHaveBeenCalledWith('mentor-1', { q: 'ada', status: 'excused' });
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
      makeController().update(request, 7, { status: 'excused', reason: 'Sick' }),
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

const record = {
  id: 7,
  userId: 'student-1',
  memberName: 'Ada Lovelace',
  checkedInAt: '2026-11-07T14:00:00.000Z',
  checkedOutAt: '2026-11-07T18:00:00.000Z',
  status: 'excused',
};
