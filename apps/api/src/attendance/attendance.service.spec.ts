import { PgDialect } from 'drizzle-orm/pg-core';
import { errAsync, okAsync } from 'neverthrow';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessService } from '../access/access.service.js';
import type { SeasonAuthorizationService } from '../seasons/season-authorization.service.js';
import type { AttendanceRepository } from './attendance.repository.js';
import { AttendanceService, completedHours } from './attendance.service.js';
import { AttendanceCodeService } from './attendance-code.service.js';

const discordId = '123456789012345678';
const targetDiscordId = '987654321098765432';
const userId = 'user-1';
const actorUserId = 'actor-1';

function makeAttendance(checkedInAt: Date, checkedOutAt: Date | null = null) {
  return {
    id: 1,
    userId,
    checkedInAt: checkedInAt.toISOString(),
    checkedOutAt: checkedOutAt?.toISOString() ?? null,
    category: 'meeting' as const,
    eventId: null,
  };
}

describe('AttendanceService', () => {
  const repository = {
    getLast: vi.fn(),
    createRecord: vi.fn(),
    getUserIdByDiscordId: vi.fn(),
    updateLast: vi.fn(),
  };

  const codeService = {
    verify: vi.fn(),
  };

  const access = {
    isSuspended: vi.fn(),
  };

  const seasonAuthorization = {
    canManageAttendance: vi.fn(),
  };
  const membership = {
    state: 'active',
    removed_at: null,
    started_at: new Date('2026-01-01T00:00:00Z'),
    joined_at: new Date('2026-01-01T00:00:00Z'),
    ended_at: null,
  };
  const roster = {
    ensureCurrentMembership: vi.fn(),
    getOwnCurrent: vi.fn(),
  };

  let service: AttendanceService;

  beforeEach(() => {
    vi.clearAllMocks();
    access.isSuspended.mockResolvedValue(false);
    seasonAuthorization.canManageAttendance.mockResolvedValue(true);
    repository.getUserIdByDiscordId.mockReturnValue(okAsync(userId));
    roster.ensureCurrentMembership.mockResolvedValue(membership);
    roster.getOwnCurrent.mockResolvedValue(membership);

    service = new AttendanceService(
      repository as unknown as AttendanceRepository,
      {} as never,
      codeService as unknown as AttendanceCodeService,
      access as unknown as AccessService,
      seasonAuthorization as unknown as SeasonAuthorizationService,
      roster as never,
    );
  });

  describe('recordAttendance', () => {
    it('creates a record when the user has no open session', async () => {
      const checkedInAt = new Date('2026-10-15T14:00:00Z');

      repository.getLast.mockReturnValue(okAsync(null));
      repository.createRecord.mockReturnValue(okAsync(makeAttendance(checkedInAt)));

      const result = await service.recordAttendance(discordId, 'meeting', null, checkedInAt);

      expect(result.isOk()).toBe(true);
      expect(roster.ensureCurrentMembership).toHaveBeenCalledWith(userId, checkedInAt);
      expect(repository.createRecord).toHaveBeenCalledWith(
        {
          userId,
          checkedInAt,
          category: 'meeting',
          eventId: null,
        },
        undefined,
      );
    });

    it('errors when the user already has a recent open session', async () => {
      vi.useFakeTimers();

      const checkedInAt = new Date('2026-10-15T14:00:00Z');
      vi.setSystemTime(checkedInAt);

      repository.getLast.mockReturnValue(okAsync(makeAttendance(new Date('2026-10-15T13:00:00Z'))));

      try {
        const result = await service.recordAttendance(discordId, 'meeting', null, checkedInAt);

        expect(result.isErr()).toBe(true);
        expect(result._unsafeUnwrapErr().message).toBe('User is already signed in');
        expect(repository.createRecord).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it('credits a stale open session and signs the user in', async () => {
      const checkedInAt = new Date('2026-10-15T14:00:00Z');
      const staleSignIn = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const staleAttendance = makeAttendance(staleSignIn);
      const creditedAttendance = makeAttendance(
        staleSignIn,
        new Date(staleSignIn.getTime() + 90 * 60 * 1000),
      );

      repository.getLast
        .mockReturnValueOnce(okAsync(staleAttendance))
        .mockReturnValueOnce(okAsync(staleAttendance));
      repository.getUserIdByDiscordId.mockReturnValue(okAsync(userId));
      repository.updateLast.mockReturnValue(okAsync(creditedAttendance));
      repository.createRecord.mockReturnValue(okAsync(makeAttendance(checkedInAt)));

      const result = await service.recordAttendance(discordId, 'meeting', null, checkedInAt);

      expect(result.isOk()).toBe(true);
      expect(repository.updateLast).toHaveBeenCalledWith(
        userId,
        {
          checkedOutAt: new Date(staleSignIn.getTime() + 90 * 60 * 1000),
        },
        undefined,
      );
      expect(repository.createRecord).toHaveBeenCalledWith(
        {
          userId,
          checkedInAt,
          category: 'meeting',
          eventId: null,
        },
        undefined,
      );
    });

    it('returns an error when ensuring the season membership fails', async () => {
      roster.ensureCurrentMembership.mockRejectedValue(new Error('No active season found'));

      const result = await service.recordAttendance(discordId, 'meeting', null);

      expect(result.isErr()).toBe(true);
      expect(repository.getLast).not.toHaveBeenCalled();
      expect(repository.createRecord).not.toHaveBeenCalled();
    });

    it('rejects a suspended member before joining a season or recording attendance', async () => {
      access.isSuspended.mockResolvedValue(true);

      const result = await service.recordAttendance(discordId, 'meeting', null);

      expect(result._unsafeUnwrapErr().message).toBe('Account is suspended');
      expect(roster.ensureCurrentMembership).not.toHaveBeenCalled();
      expect(repository.createRecord).not.toHaveBeenCalled();
    });

    it('rejects a removed season membership without recording attendance', async () => {
      roster.ensureCurrentMembership.mockResolvedValue({ ...membership, state: 'removed' });

      const result = await service.recordAttendance(discordId, 'meeting', null);

      expect(result._unsafeUnwrapErr().message).toBe('Season membership is removed');
      expect(repository.createRecord).not.toHaveBeenCalled();
    });

    it('fails closed if roster admission cannot be verified', async () => {
      roster.ensureCurrentMembership.mockRejectedValue(
        new Error('Discord membership could not be verified'),
      );

      const result = await service.recordAttendance(discordId, 'meeting', null);

      expect(result.isErr()).toBe(true);
      expect(repository.createRecord).not.toHaveBeenCalled();
    });
  });

  describe('sign-out eligibility', () => {
    it('rejects a suspended member before updating attendance', async () => {
      access.isSuspended.mockResolvedValue(true);

      const result = await service.updateAttendance(discordId, { checkedOutAt: new Date() });

      expect(result._unsafeUnwrapErr().message).toBe('Account is suspended');
      expect(repository.updateLast).not.toHaveBeenCalled();
    });

    it('rejects a removed membership and never creates one during sign-out', async () => {
      roster.getOwnCurrent.mockResolvedValue({ ...membership, state: 'removed' });

      const result = await service.updateAttendance(discordId, { checkedOutAt: new Date() });

      expect(result._unsafeUnwrapErr().message).toBe('Season membership is removed');
      expect(roster.ensureCurrentMembership).not.toHaveBeenCalled();
      expect(repository.updateLast).not.toHaveBeenCalled();
    });
  });

  describe('mentor attendance operations', () => {
    it('allows an active mentor to sign in another member', async () => {
      repository.getUserIdByDiscordId.mockReturnValue(okAsync(actorUserId));
      const recordAttendance = vi
        .spyOn(service, 'recordAttendance')
        .mockReturnValue(okAsync(undefined));

      const result = await service.signInForMember(discordId, targetDiscordId);

      expect(result.isOk()).toBe(true);
      expect(repository.getUserIdByDiscordId).toHaveBeenCalledWith(discordId);
      expect(access.isSuspended).toHaveBeenCalledWith(actorUserId);
      expect(seasonAuthorization.canManageAttendance).toHaveBeenCalledWith(actorUserId);
      expect(recordAttendance).toHaveBeenCalledWith(
        targetDiscordId,
        'meeting',
        null,
        expect.any(Date),
        false,
        actorUserId,
      );
    });

    it('allows an active Team Admin to sign out another member', async () => {
      repository.getUserIdByDiscordId.mockReturnValue(okAsync(actorUserId));
      const updateAttendance = vi
        .spyOn(service, 'updateAttendance')
        .mockReturnValue(okAsync(undefined));

      const result = await service.signOutForMember(discordId, targetDiscordId);

      expect(result.isOk()).toBe(true);
      expect(updateAttendance).toHaveBeenCalledWith(
        targetDiscordId,
        expect.objectContaining({ checkedOutAt: expect.any(Date) }),
        actorUserId,
      );
    });

    it('rejects a user without mentor or Team Admin access', async () => {
      repository.getUserIdByDiscordId.mockReturnValue(okAsync(actorUserId));
      seasonAuthorization.canManageAttendance.mockResolvedValue(false);
      const recordAttendance = vi.spyOn(service, 'recordAttendance');

      const result = await service.signInForMember(discordId, targetDiscordId);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toBe('Not authorized to manage attendance');
      expect(recordAttendance).not.toHaveBeenCalled();
    });

    it('rejects a suspended mentor', async () => {
      repository.getUserIdByDiscordId.mockReturnValue(okAsync(actorUserId));
      access.isSuspended.mockResolvedValue(true);
      const recordAttendance = vi.spyOn(service, 'recordAttendance');

      const result = await service.signInForMember(discordId, targetDiscordId);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toBe('Not authorized to manage attendance');
      expect(recordAttendance).not.toHaveBeenCalled();
    });

    it('does not enroll an unjoined target through a mentor command', async () => {
      repository.getUserIdByDiscordId.mockImplementation((id: string) =>
        okAsync(id === discordId ? actorUserId : userId),
      );
      roster.getOwnCurrent.mockResolvedValue(null);

      const result = await service.signInForMember(discordId, targetDiscordId);

      expect(result._unsafeUnwrapErr().message).toBe('No active season membership');
      expect(roster.ensureCurrentMembership).not.toHaveBeenCalled();
      expect(repository.createRecord).not.toHaveBeenCalled();
    });

    it('passes the persistent mentor ID to the sign-in audit', async () => {
      repository.getUserIdByDiscordId.mockImplementation((id: string) =>
        okAsync(id === discordId ? actorUserId : userId),
      );
      repository.getLast.mockReturnValue(okAsync(null));
      repository.createRecord.mockReturnValue(okAsync(makeAttendance(new Date())));

      const result = await service.signInForMember(discordId, targetDiscordId);

      expect(result.isOk()).toBe(true);
      expect(repository.createRecord).toHaveBeenCalledWith(
        expect.objectContaining({ userId, category: 'meeting' }),
        {
          actorUserId,
          action: 'mentor_signed_in',
          reason: 'Mentor-assisted attendance command',
        },
      );
    });

    it('passes the persistent mentor ID to the sign-out audit', async () => {
      repository.getUserIdByDiscordId.mockImplementation((id: string) =>
        okAsync(id === discordId ? actorUserId : userId),
      );
      repository.getLast.mockReturnValue(okAsync(makeAttendance(new Date())));
      repository.updateLast.mockReturnValue(okAsync(makeAttendance(new Date(), new Date())));

      const result = await service.signOutForMember(discordId, targetDiscordId);

      expect(result.isOk()).toBe(true);
      expect(repository.updateLast).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ checkedOutAt: expect.any(Date) }),
        {
          actorUserId,
          action: 'mentor_signed_out',
          reason: 'Mentor-assisted attendance command',
        },
      );
    });

    it('audits a stale-session credit before a mentor-assisted sign-in', async () => {
      vi.useFakeTimers();
      const now = new Date('2026-11-28T16:00:00.000Z');
      const staleSignIn = new Date('2026-11-26T14:00:00.000Z');
      vi.setSystemTime(now);
      repository.getUserIdByDiscordId.mockImplementation((id: string) =>
        okAsync(id === discordId ? actorUserId : userId),
      );
      repository.getLast
        .mockReturnValueOnce(okAsync(makeAttendance(staleSignIn)))
        .mockReturnValueOnce(okAsync(makeAttendance(staleSignIn)));
      repository.updateLast.mockReturnValue(
        okAsync(makeAttendance(staleSignIn, new Date(staleSignIn.getTime() + 90 * 60 * 1000))),
      );
      repository.createRecord.mockReturnValue(okAsync(makeAttendance(now)));

      try {
        const result = await service.signInForMember(discordId, targetDiscordId);

        expect(result.isOk()).toBe(true);
        expect(repository.updateLast).toHaveBeenCalledWith(
          userId,
          { checkedOutAt: new Date(staleSignIn.getTime() + 90 * 60 * 1000) },
          {
            actorUserId,
            action: 'stale_session_credited',
            reason: 'Mentor-assisted attendance command',
          },
        );
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('getOverviewForDiscordUser', () => {
    it('looks up the Basecamp user and returns their season overview', async () => {
      const overview = { season: null, progress: null };
      repository.getUserIdByDiscordId.mockReturnValue(okAsync(userId));
      const spy = vi.spyOn(service, 'overview').mockResolvedValue(overview as never);
      const now = new Date('2026-11-09T23:00:00.000Z');

      const result = await service.getOverviewForDiscordUser(discordId, now);

      expect(result._unsafeUnwrap()).toBe(overview);
      expect(repository.getUserIdByDiscordId).toHaveBeenCalledWith(discordId);
      expect(spy).toHaveBeenCalledWith(userId, now);
    });

    it('rejects suspended users before loading their attendance', async () => {
      repository.getUserIdByDiscordId.mockReturnValue(okAsync(userId));
      access.isSuspended.mockResolvedValue(true);
      const overview = vi.spyOn(service, 'overview');

      const result = await service.getOverviewForDiscordUser(discordId);

      expect(result._unsafeUnwrapErr().message).toBe('Account is suspended');
      expect(access.isSuspended).toHaveBeenCalledWith(userId);
      expect(overview).not.toHaveBeenCalled();
    });

    it('fails closed if the suspension check fails', async () => {
      repository.getUserIdByDiscordId.mockReturnValue(okAsync(userId));
      access.isSuspended.mockRejectedValue(new Error('Access check failed'));
      const overview = vi.spyOn(service, 'overview');

      const result = await service.getOverviewForDiscordUser(discordId);

      expect(result._unsafeUnwrapErr().message).toBe('Access check failed');
      expect(overview).not.toHaveBeenCalled();
    });

    it('returns lookup and overview failures as errors', async () => {
      repository.getUserIdByDiscordId.mockReturnValueOnce(errAsync(new Error('User not found')));
      expect((await service.getOverviewForDiscordUser(discordId))._unsafeUnwrapErr().message).toBe(
        'User not found',
      );

      repository.getUserIdByDiscordId.mockReturnValueOnce(okAsync(userId));
      vi.spyOn(service, 'overview').mockRejectedValueOnce('database offline');
      expect((await service.getOverviewForDiscordUser(discordId))._unsafeUnwrapErr().message).toBe(
        'database offline',
      );
    });
  });

  describe('signInWithCode', () => {
    it('rejects an invalid code without recording attendance', async () => {
      codeService.verify.mockResolvedValue(false);

      const result = await service.signInWithCode(discordId, 'bad-code');

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toBe('Invalid attendance code');
      expect(roster.ensureCurrentMembership).not.toHaveBeenCalled();
    });
  });
});

describe('completedHours', () => {
  const start = new Date('2026-10-15T14:00:00Z');
  const end = new Date('2026-10-15T18:00:00Z');

  it('returns the duration of a completed session', () => {
    expect(
      completedHours(
        {
          id: 1,
          category: 'meeting',
          checkedInAt: start,
          checkedOutAt: new Date('2026-10-15T16:30:00Z'),
          name: null,
        },
        start,
        end,
      ),
    ).toBe(2.5);
  });

  it('clips session hours to the requested time range', () => {
    expect(
      completedHours(
        {
          id: 1,
          category: 'meeting',
          checkedInAt: new Date('2026-10-15T13:00:00Z'),
          checkedOutAt: new Date('2026-10-15T19:00:00Z'),
          name: null,
        },
        start,
        end,
      ),
    ).toBe(4);
  });

  it('counts no hours for an open session', () => {
    expect(
      completedHours(
        {
          id: 1,
          category: 'meeting',
          checkedInAt: start,
          checkedOutAt: null,
          name: null,
        },
        start,
        end,
      ),
    ).toBe(0);
  });
});
describe('AttendanceService.overview', () => {
  // Each query resolves to its rows whichever builder method ends the chain.
  function query(rows: unknown[]) {
    const builder = Object.assign(Promise.resolve(rows), {
      from: vi.fn(() => builder),
      leftJoin: vi.fn(() => builder),
      where: vi.fn(() => builder),
      orderBy: vi.fn(() => builder),
      limit: vi.fn(() => builder),
    });
    return builder;
  }

  const db = { select: vi.fn() };
  const now = new Date('2026-11-09T23:00:00.000Z');
  const season = {
    id: 1,
    name: '2026–27',
    started_at: new Date('2026-05-15T04:00:00.000Z'),
    ended_at: new Date('2027-05-15T03:59:59.000Z'),
  };
  const membership = {
    role: 'student',
    student_experience: 'rookie',
    legacy_status: null,
  };
  const requirementRows = [
    { category: 'meeting', is_leader: false, required_hours: 26 },
    { category: 'meeting', is_leader: true, required_hours: 39 },
    { category: 'outreach', is_leader: false, required_hours: 5 },
  ];
  const meetings = [
    {
      id: 1,
      startsAt: new Date('2026-11-03T21:30:00.000Z'),
      endsAt: new Date('2026-11-04T00:30:00.000Z'),
    },
    {
      id: 2,
      startsAt: new Date('2026-11-07T14:00:00.000Z'),
      endsAt: new Date('2026-11-07T18:00:00.000Z'),
    },
    {
      id: 3,
      startsAt: new Date('2026-11-10T21:30:00.000Z'),
      endsAt: new Date('2026-11-11T00:30:00.000Z'),
    },
  ];
  const records = [
    {
      id: 11,
      category: 'meeting',
      status: 'excused',
      eventId: 2,
      name: 'Saturday build',
      checkedInAt: new Date('2026-11-07T14:00:00.000Z'),
      checkedOutAt: new Date('2026-11-07T18:00:00.000Z'),
    },
    {
      id: 10,
      category: 'outreach',
      status: 'normal',
      eventId: null,
      name: null,
      checkedInAt: new Date('2026-11-01T16:00:00.000Z'),
      checkedOutAt: new Date('2026-11-01T18:00:00.000Z'),
    },
  ];

  function makeService() {
    return new AttendanceService(
      {} as never,
      { db } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  }

  function mockQueries(memberships: unknown[], requirements = requirementRows) {
    db.select
      .mockReturnValueOnce(query([season]))
      .mockReturnValueOnce(query(records))
      .mockReturnValueOnce(query(memberships))
      .mockReturnValueOnce(query(meetings))
      .mockReturnValueOnce(query(requirements));
  }

  beforeEach(() => {
    db.select.mockReset();
  });

  it('returns empty progress when no season is active', async () => {
    db.select.mockReturnValueOnce(query([]));

    await expect(makeService().overview('user-1', now)).resolves.toEqual({
      season: null,
      hours: { meeting: 0, outreach: 0, total: 0 },
      requirements: null,
      progress: null,
      recentActivity: [],
    });
  });

  it("compares a member's hours and meetings with what is expected so far", async () => {
    mockQueries([membership]);

    const overview = await makeService().overview('user-1', now);

    expect(overview.hours).toEqual({ meeting: 4, outreach: 2, total: 6 });
    expect(overview.requirements).toEqual({ meeting: 26, outreach: 5, track: 'member' });
    expect(overview.progress).toEqual({
      completedMeetings: 2,
      attendedMeetings: 0,
      excusedMeetings: 1,
      missedMeetings: 1,
      completedMeetingHours: 7,
      scheduledMeetingHours: 10,
      expectedHours: { member: 18.2, leadership: 27.3 },
    });
    expect(overview.recentActivity[0]).toMatchObject({
      name: 'Saturday build',
      status: 'excused',
      hours: 4,
    });
    expect(overview.recentActivity[1]).toMatchObject({ name: 'Outreach event' });
  });

  it('measures Student Leaders against the leadership meeting target', async () => {
    mockQueries([{ ...membership, role: 'student_leader' }]);

    const overview = await makeService().overview('user-1', now);

    expect(overview.requirements).toEqual({ meeting: 39, outreach: 5, track: 'leadership' });
  });

  it('still counts meetings for someone without an active membership', async () => {
    db.select
      .mockReturnValueOnce(query([season]))
      .mockReturnValueOnce(query(records))
      .mockReturnValueOnce(query([]))
      .mockReturnValueOnce(query(meetings));

    const overview = await makeService().overview('user-1', now);

    expect(overview.requirements).toBeNull();
    expect(overview.progress).toMatchObject({
      completedMeetings: 2,
      expectedHours: { member: null, leadership: null },
    });
    expect(db.select).toHaveBeenCalledTimes(4);
  });
});

describe('AttendanceService.getLeaderboardForDiscordUser', () => {
  const now = new Date('2026-11-09T23:00:00.000Z');
  const season = {
    id: 1,
    name: '2026–27',
    started_at: new Date('2026-05-15T04:00:00.000Z'),
    ended_at: new Date('2027-05-15T03:59:59.000Z'),
  };
  const repository = { getUserIdByDiscordId: vi.fn() };
  const access = { isSuspended: vi.fn() };
  const authorization = { canManageAttendance: vi.fn() };
  const db = { select: vi.fn() };

  function query(rows: unknown[]) {
    const builder = Object.assign(Promise.resolve(rows), {
      from: vi.fn(() => builder),
      innerJoin: vi.fn(() => builder),
      where: vi.fn((_condition: unknown) => builder),
      orderBy: vi.fn(() => builder),
      limit: vi.fn(() => builder),
    });
    return builder;
  }

  function makeService() {
    return new AttendanceService(
      repository as never,
      { db } as never,
      {} as never,
      access as never,
      authorization as never,
      {} as never,
    );
  }

  function record(
    userId: string,
    name: string,
    hours: number,
    preferredName: string | null = null,
  ) {
    const checkedInAt = new Date('2026-11-01T12:00:00.000Z');
    return {
      id: 1,
      userId,
      name,
      preferredName,
      category: 'meeting' as const,
      checkedInAt,
      checkedOutAt: new Date(checkedInAt.getTime() + hours * 3_600_000) as Date | null,
    };
  }

  function mockQueries(rows: unknown[]) {
    const recordsQuery = query(rows);
    db.select.mockReturnValueOnce(query([season])).mockReturnValueOnce(recordsQuery);
    return recordsQuery;
  }

  beforeEach(() => {
    vi.resetAllMocks();
    repository.getUserIdByDiscordId.mockReturnValue(okAsync(actorUserId));
    access.isSuspended.mockResolvedValue(false);
    authorization.canManageAttendance.mockResolvedValue(true);
  });

  it('rejects unlinked Discord identities before querying attendance', async () => {
    repository.getUserIdByDiscordId.mockReturnValue(errAsync(new Error('User not found')));
    const result = await makeService().getLeaderboardForDiscordUser(discordId, now);

    expect(result._unsafeUnwrapErr().message).toBe('User not found');
    expect(db.select).not.toHaveBeenCalled();
  });

  it('rejects callers without attendance management permissions', async () => {
    authorization.canManageAttendance.mockResolvedValue(false);
    const result = await makeService().getLeaderboardForDiscordUser(discordId, now);

    expect(result._unsafeUnwrapErr().message).toBe('Not authorized to manage attendance');
    expect(authorization.canManageAttendance).toHaveBeenCalledWith(actorUserId);
    expect(db.select).not.toHaveBeenCalled();
  });

  it('rejects suspended attendance managers', async () => {
    access.isSuspended.mockResolvedValue(true);
    const result = await makeService().getLeaderboardForDiscordUser(discordId, now);

    expect(result._unsafeUnwrapErr().message).toBe('Not authorized to manage attendance');
    expect(access.isSuspended).toHaveBeenCalledWith(actorUserId);
    expect(db.select).not.toHaveBeenCalled();
  });

  it('returns no entries when no season is active', async () => {
    db.select.mockReturnValueOnce(query([]));
    const result = await makeService().getLeaderboardForDiscordUser(discordId, now);

    expect(result._unsafeUnwrap()).toEqual({ season: null, entries: [] });
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it('returns an empty leaderboard when there are no qualifying records', async () => {
    mockQueries([]);
    const result = await makeService().getLeaderboardForDiscordUser(discordId, now);

    expect(result._unsafeUnwrap()).toEqual({
      season: { id: season.id, name: season.name },
      entries: [],
    });
  });

  it('aggregates sessions by persistent user ID, not display name', async () => {
    mockQueries([
      record('student-1', 'Discord name', 3, ' Ada '),
      record('student-1', 'Discord name', 2.5, ' Ada '),
      record('student-2', 'Ada', 4, ' '),
    ]);
    const result = await makeService().getLeaderboardForDiscordUser(discordId, now);

    expect(result._unsafeUnwrap().entries).toEqual([
      { rank: 1, name: 'Ada', hours: 5.5 },
      { rank: 2, name: 'Ada', hours: 4 },
    ]);
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it('returns at most five entries, sorted by hours with shared ranks for ties', async () => {
    mockQueries([
      record('a', 'Zoe', 8),
      record('b', 'Ada', 8),
      record('c', 'Grace', 7),
      record('d', 'Sam', 6),
      record('e', 'Alex', 5),
      record('f', 'Taylor', 4),
    ]);
    const result = await makeService().getLeaderboardForDiscordUser(discordId, now);

    expect(result._unsafeUnwrap().entries).toEqual([
      { rank: 1, name: 'Ada', hours: 8 },
      { rank: 1, name: 'Zoe', hours: 8 },
      { rank: 3, name: 'Grace', hours: 7 },
      { rank: 4, name: 'Sam', hours: 6 },
      { rank: 5, name: 'Alex', hours: 5 },
    ]);
  });

  it('clips hours to the season start and current time and ignores open sessions', async () => {
    mockQueries([
      {
        ...record('a', 'Ada', 0),
        checkedInAt: new Date('2026-05-15T03:00:00.000Z'),
        checkedOutAt: new Date('2026-05-15T05:00:00.000Z'),
      },
      {
        ...record('a', 'Ada', 0),
        checkedInAt: new Date('2026-11-09T21:30:00.000Z'),
        checkedOutAt: new Date('2026-11-10T01:00:00.000Z'),
      },
      { ...record('b', 'Grace', 0), checkedOutAt: null },
      record('c', 'Sam', 0),
    ]);
    const result = await makeService().getLeaderboardForDiscordUser(discordId, now);

    expect(result._unsafeUnwrap().entries).toEqual([{ rank: 1, name: 'Ada', hours: 2.5 }]);
  });

  it('rounds totals to two decimals after summing sessions', async () => {
    mockQueries([record('a', 'Ada', 1.234), record('a', 'Ada', 1.234)]);
    const result = await makeService().getLeaderboardForDiscordUser(discordId, now);

    expect(result._unsafeUnwrap().entries).toEqual([{ rank: 1, name: 'Ada', hours: 2.47 }]);
  });

  it('queries only eligible current-season student meeting records', async () => {
    const recordsQuery = mockQueries([]);
    await makeService().getLeaderboardForDiscordUser(discordId, now);

    expect(recordsQuery.innerJoin).toHaveBeenCalledTimes(2);
    const condition = recordsQuery.where.mock.calls[0]?.[0];
    const compiled = new PgDialect().sqlToQuery(
      condition as Parameters<PgDialect['sqlToQuery']>[0],
    );
    expect(compiled.sql).toContain('"season_memberships"."season_id"');
    expect(compiled.sql).toContain('"season_memberships"."state"');
    expect(compiled.sql).toContain('"season_memberships"."role"');
    expect(compiled.sql).toContain('"user"."banned"');
    expect(compiled.sql).toContain('"attendance"."category"');
    expect(compiled.sql).toContain('"attendance"."checked_out_at"');
    expect(compiled.params).toEqual(
      expect.arrayContaining([season.id, 'active', 'student', 'student_leader', false, 'meeting']),
    );
  });

  it('returns database failures as errors', async () => {
    db.select.mockImplementationOnce(() => {
      throw new Error('Database unavailable');
    });
    const result = await makeService().getLeaderboardForDiscordUser(discordId, now);

    expect(result._unsafeUnwrapErr().message).toBe('Database unavailable');
  });
});
