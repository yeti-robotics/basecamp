import 'reflect-metadata';

import { Test, type TestingModule } from '@nestjs/testing';
import { PgDialect } from 'drizzle-orm/pg-core';
import { okAsync } from 'neverthrow';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../database/database.service.js';
import { AttendanceRepository } from './attendance.repository.js';
import type { Attendance } from './attendance.schema.js';
import { AttendanceService, completedHours } from './attendance.service.js';
import { AttendanceCodeService } from './attendance-code.service.js';

const mockCodeService = { verify: vi.fn() };

const mockRepository = {
  getUserIdByDiscordId: vi.fn(),
  getLast: vi.fn(),
  createRecord: vi.fn(),
  updateLast: vi.fn(),
};

const USER_ID = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const DISCORD_ID = '123456789012345678';

function makeAttendance(overrides: Partial<Attendance> = {}): Attendance {
  return {
    id: 1,
    userId: USER_ID,
    checkedInAt: '2026-10-31T14:00:00.000Z',
    checkedOutAt: null,
    category: 'meeting',
    eventId: null,
    ...overrides,
  };
}

describe('AttendanceService', () => {
  let service: AttendanceService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: AttendanceCodeService, useValue: mockCodeService },
        { provide: DatabaseService, useValue: { db: {} } },
        { provide: AttendanceRepository, useValue: mockRepository },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);

    mockRepository.getUserIdByDiscordId.mockReturnValue(okAsync(USER_ID));
    mockCodeService.verify.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('recordAttendance', () => {
    it('creates a record when the user has no open session', async () => {
      mockRepository.getLast.mockReturnValue(okAsync(null));
      mockRepository.createRecord.mockReturnValue(okAsync(makeAttendance()));

      const result = await service.recordAttendance(DISCORD_ID, 'meeting', null);

      expect(result.isOk()).toBe(true);
      expect(mockRepository.createRecord).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER_ID, category: 'meeting' }),
      );
    });

    it('errors when the user already has a recent open session', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-31T15:00:00Z')); //not stale

      mockRepository.getLast.mockReturnValue(
        okAsync(makeAttendance({ checkedInAt: '2026-10-31T14:00:00.000Z', checkedOutAt: null })),
      );

      const result = await service.recordAttendance(DISCORD_ID, 'meeting', null);

      expect(result.isErr()).toBe(true);
      expect(mockRepository.createRecord).not.toHaveBeenCalled();
    });

    it('credits a stale open session and signs the user in', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-11-01T10:00:00Z'));

      const staleSession = makeAttendance({
        checkedInAt: '2026-10-31T14:00:00.000Z',
        checkedOutAt: null,
      });
      mockRepository.getLast.mockReturnValue(okAsync(staleSession));
      mockRepository.updateLast.mockReturnValue(
        okAsync(makeAttendance({ checkedOutAt: '2026-10-31T15:30:00.000Z' })),
      );
      mockRepository.createRecord.mockReturnValue(okAsync(makeAttendance()));

      const result = await service.recordAttendance(DISCORD_ID, 'meeting', null);

      expect(result.isOk()).toBe(true);
      expect(mockRepository.updateLast).toHaveBeenCalled();
      expect(mockRepository.createRecord).toHaveBeenCalled();
    });
  });

  describe('updateAttendance', () => {
    it('errors when the user has never signed in', async () => {
      mockRepository.getLast.mockReturnValue(okAsync(null));

      const result = await service.updateAttendance(DISCORD_ID, { checkedOutAt: new Date() });

      expect(result.isErr()).toBe(true);
    });

    it('errors when the user is already signed out', async () => {
      mockRepository.getLast.mockReturnValue(
        okAsync(makeAttendance({ checkedOutAt: '2026-10-31T17:00:00.000Z' })),
      );

      const result = await service.updateAttendance(DISCORD_ID, { checkedOutAt: new Date() });

      expect(result.isErr()).toBe(true);
    });

    it('signs the user out successfully', async () => {
      mockRepository.getLast.mockReturnValue(okAsync(makeAttendance({ checkedOutAt: null })));
      mockRepository.updateLast.mockReturnValue(
        okAsync(makeAttendance({ checkedOutAt: '2026-10-31T17:00:00.000Z' })),
      );

      const result = await service.updateAttendance(DISCORD_ID, { checkedOutAt: new Date() });

      expect(result.isOk()).toBe(true);
      expect(mockRepository.updateLast).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ checkedOutAt: expect.any(Date) }),
      );
    });

    it('updates fields directly without the signed-out check when checkedOutAt is omitted', async () => {
      mockRepository.updateLast.mockReturnValue(okAsync(makeAttendance({ category: 'outreach' })));

      const result = await service.updateAttendance(DISCORD_ID, { category: 'outreach' });

      expect(result.isOk()).toBe(true);
      expect(mockRepository.getLast).not.toHaveBeenCalled();
      expect(mockRepository.updateLast).toHaveBeenCalledWith(USER_ID, { category: 'outreach' });
    });
  });

  describe('handleForgotToSignOut', () => {
    it('credits a stale session with a default duration', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-11-01T10:00:00Z'));

      const staleSession = makeAttendance({
        checkedInAt: '2026-10-31T14:00:00.000Z',
        checkedOutAt: null,
      });
      mockRepository.getLast.mockReturnValue(okAsync(staleSession));
      mockRepository.updateLast.mockReturnValue(
        okAsync(makeAttendance({ checkedOutAt: '2026-10-31T15:30:00.000Z' })),
      );

      const result = await service.handleForgotToSignOut(DISCORD_ID);

      expect(result.isOk()).toBe(true);
      expect(mockRepository.updateLast).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ checkedOutAt: expect.any(Date) }),
      );
    });

    it('does not change a non-stale session', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-31T15:00:00Z')); //not stale

      const recentSession = makeAttendance({
        checkedInAt: '2026-10-31T14:00:00.000Z',
        checkedOutAt: null,
      });
      mockRepository.getLast.mockReturnValue(okAsync(recentSession));

      const result = await service.handleForgotToSignOut(DISCORD_ID);

      expect(result.isOk()).toBe(true);
      expect(mockRepository.updateLast).not.toHaveBeenCalled();
    });
  });
  it('requires a display code before self-service writes and lets two members share one code', async () => {
    const secondDiscordId = '234567890123456789';
    const records = new Map<string, Attendance>();
    mockCodeService.verify.mockImplementation(async (code: string) => code === '0042');
    mockRepository.getUserIdByDiscordId.mockImplementation((discordId: string) =>
      okAsync(discordId),
    );
    mockRepository.getLast.mockImplementation((userId: string) =>
      okAsync(records.get(userId) ?? null),
    );
    mockRepository.createRecord.mockImplementation((input) => {
      const row = makeAttendance({
        id: records.size + 1,
        userId: input.userId,
        checkedInAt: input.checkedInAt.toISOString(),
        checkedOutAt: null,
      });
      records.set(input.userId, row);
      return okAsync(row);
    });
    mockRepository.updateLast.mockImplementation((userId: string, updates) => {
      const row = records.get(userId);
      if (!row) throw new Error('Missing fake attendance record');
      const updated = {
        ...row,
        checkedOutAt: updates.checkedOutAt?.toISOString() ?? row.checkedOutAt,
      };
      records.set(userId, updated);
      return okAsync(updated);
    });

    expect((await service.signInWithCode(DISCORD_ID, '9999')).isErr()).toBe(true);
    expect((await service.signOutWithCode(DISCORD_ID, '42')).isErr()).toBe(true);
    expect(records.size).toBe(0);
    expect(mockRepository.createRecord).not.toHaveBeenCalled();
    expect(mockRepository.updateLast).not.toHaveBeenCalled();

    expect((await service.signInWithCode(DISCORD_ID, '0042')).isOk()).toBe(true);
    expect((await service.signInWithCode(secondDiscordId, '0042')).isOk()).toBe(true);
    expect(records.size).toBe(2);
    expect((await service.signInWithCode(DISCORD_ID, '0042')).isErr()).toBe(true);
    expect((await service.signOutWithCode(DISCORD_ID, '0042')).isOk()).toBe(true);
    expect(records.get(DISCORD_ID)?.checkedOutAt).toEqual(expect.any(String));
  });
});

const start = new Date('2026-09-01T00:00:00Z');
const now = new Date('2026-10-13T18:00:00Z');
const record = {
  id: 1,
  category: 'meeting' as const,
  name: 'Build meeting',
  checkedInAt: new Date('2026-10-12T16:00:00Z'),
  checkedOutAt: new Date('2026-10-12T18:30:00Z'),
};

function setup(results: unknown[][]) {
  const queries: ReturnType<typeof vi.fn>[] = [];
  const select = vi.fn(() => {
    const result = results.shift();
    const chain = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      // biome-ignore lint/suspicious/noThenProperty: Drizzle queries are awaitable builders.
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
    };
    queries.push(chain.where);
    return chain;
  });
  return {
    service: new AttendanceService(
      mockRepository as unknown as AttendanceRepository,
      { db: { select } } as unknown as DatabaseService,
      mockCodeService as unknown as AttendanceCodeService,
    ),
    select,
    queries,
  };
}

describe('completedHours', () => {
  it('counts elapsed hours for completed sessions', () =>
    expect(completedHours(record, start, now)).toBe(2.5));
  it('does not credit an open or invalid session', () => {
    expect(completedHours({ ...record, checkedOutAt: null }, start, now)).toBe(0);
    expect(completedHours({ ...record, checkedOutAt: start }, start, now)).toBe(0);
  });
  it('clips sessions to the season start and current time', () => {
    expect(
      completedHours(
        {
          ...record,
          checkedInAt: new Date(start.getTime() - 3_600_000),
          checkedOutAt: new Date(start.getTime() + 3_600_000),
        },
        start,
        now,
      ),
    ).toBe(1);
    expect(
      completedHours(
        {
          ...record,
          checkedInAt: new Date(now.getTime() - 3_600_000),
          checkedOutAt: new Date(now.getTime() + 3_600_000),
        },
        start,
        now,
      ),
    ).toBe(1);
  });
});

describe('AttendanceService', () => {
  const season = { id: 7, name: '2026–27', started_at: start, ended_at: new Date('2027-08-01') };
  it('returns an explicit empty state without an active season', async () => {
    const { service, select } = setup([[]]);
    expect(await service.overview('member-a', now)).toEqual({
      season: null,
      hours: { meeting: 0, outreach: 0, total: 0 },
      requirements: null,
      recentActivity: [],
    });
    expect(select).toHaveBeenCalledTimes(1);
  });
  it('sums categories, returns requirements, limits activity, and scopes queries to the member', async () => {
    const records = [
      record,
      { ...record, id: 2, category: 'outreach', name: null },
      ...Array.from({ length: 4 }, (_, i) => ({ ...record, id: i + 3, checkedOutAt: null })),
    ];
    const { service, queries } = setup([
      [season],
      records,
      [{ status: 'rookie' }],
      [
        { category: 'meeting', required_hours: 40 },
        { category: 'outreach', required_hours: 10 },
      ],
    ]);
    const overview = await service.overview('member-a', now);
    expect(overview.hours).toEqual({ meeting: 2.5, outreach: 2.5, total: 5 });
    expect(overview.requirements).toEqual({ meeting: 40, outreach: 10 });
    expect(overview.recentActivity).toHaveLength(5);
    expect(overview.recentActivity[1].name).toBe('Outreach event');
    expect(overview.recentActivity[2].checkedOutAt).toBeNull();
    for (const index of [1, 2]) {
      const query = new PgDialect().sqlToQuery(queries[index].mock.calls[0][0]);
      expect(query.sql).toContain('"user_id" =');
      expect(query.params).toContain('member-a');
    }
  });
  it('keeps hours visible without membership or requirements', async () => {
    const { service, select } = setup([[season], [record], []]);
    const overview = await service.overview('member-a', now);
    expect(overview.hours.total).toBe(2.5);
    expect(overview.requirements).toBeNull();
    expect(select).toHaveBeenCalledTimes(3);
  });
});
