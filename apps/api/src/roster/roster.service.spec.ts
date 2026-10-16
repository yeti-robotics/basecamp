import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RosterService } from './roster.service.js';

const currentSeason = { id: 4, name: '2027–28', startsOn: '2027-05-15', endsOn: '2028-05-14' };
const userId = 'member-1';
const discordId = '123456789012345678';
const admission = { verify: vi.fn() };
const database = { transaction: vi.fn(), select: vi.fn() };

function builder(rows: unknown[]) {
  const query = {
    from: vi.fn(() => query),
    innerJoin: vi.fn(() => query),
    where: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    limit: vi.fn().mockResolvedValue(rows),
  };
  return query;
}

function membership(overrides: Record<string, unknown> = {}) {
  return {
    id: 15,
    season_id: currentSeason.id,
    user_id: userId,
    role: 'student',
    student_experience: 'rookie',
    state: 'active',
    joined_at: new Date('2027-05-15T12:00:00.000Z'),
    removed_at: null,
    legacy_status: null,
    started_at: new Date('2027-05-15T12:00:00.000Z'),
    ended_at: null,
    status_override: null,
    ...overrides,
  };
}

function makeService() {
  return new RosterService(
    { db: database } as never,
    new ConfigService({ BASECAMP_TIME_ZONE: 'America/Los_Angeles' }),
    admission as never,
  );
}

function setupTransaction(queries: unknown[][], inserted: unknown[] = [membership()]) {
  const insertValues = vi.fn().mockReturnValue({
    onConflictDoNothing: vi
      .fn()
      .mockReturnValue({ returning: vi.fn().mockResolvedValue(inserted) }),
  });
  const tx = {
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn(() => builder(queries.shift() ?? [])),
    insert: vi.fn(() => ({ values: insertValues })),
  };
  database.select.mockReturnValue(builder([currentSeason]));
  database.transaction.mockImplementation(async (callback: (tx: typeof tx) => unknown) =>
    callback(tx),
  );
  return { tx, insertValues };
}

describe('RosterService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.select.mockReturnValue(builder([currentSeason]));
    admission.verify.mockResolvedValue('allowed');
  });

  it('returns null without a current season and does not check Discord or write', async () => {
    database.select.mockReturnValue(builder([]));
    await expect(makeService().ensureCurrentMembership(userId, new Date())).resolves.toBeNull();
    expect(database.transaction).not.toHaveBeenCalled();
    expect(admission.verify).not.toHaveBeenCalled();
  });

  it('creates a new member as Student/Rookie after verifying their linked Discord identity', async () => {
    const { tx, insertValues } = setupTransaction([[], [{ discordId }], []]);
    await makeService().ensureCurrentMembership(userId, new Date('2027-06-01T12:00:00Z'));
    expect(admission.verify).toHaveBeenCalledWith(discordId);
    expect(tx.execute).toHaveBeenCalledOnce();
    expect(tx.insert).toHaveBeenCalledTimes(2);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        season_id: currentSeason.id,
        user_id: userId,
        role: 'student',
        student_experience: 'rookie',
        state: 'active',
      }),
    );
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ actor_user_id: userId, action: 'member_joined' }),
    );
  });

  it('carries a returning Student Leader and promotes an immediately prior Rookie to Veteran', async () => {
    const prior = {
      seasonId: 3,
      role: 'student_leader',
      studentExperience: 'rookie',
      state: 'active',
    };
    const { insertValues } = setupTransaction([
      [],
      [{ discordId }],
      [{ id: prior.seasonId }],
      [prior],
    ]);
    await makeService().ensureCurrentMembership(userId, new Date());
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'student_leader', student_experience: 'veteran' }),
    );
  });

  it('keeps a Rookie when their latest membership skipped the immediately previous season', async () => {
    const { insertValues } = setupTransaction([
      [],
      [{ discordId }],
      [{ id: 5 }],
      [{ seasonId: 3, role: 'student', studentExperience: 'rookie', state: 'active' }],
    ]);
    await makeService().ensureCurrentMembership(userId, new Date());
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'student', student_experience: 'rookie' }),
    );
  });

  it('starts as Student/Rookie when the most recent prior membership was removed', async () => {
    const { insertValues } = setupTransaction([
      [],
      [{ discordId }],
      [{ id: 3 }],
      [{ seasonId: 3, role: 'team_admin', studentExperience: null, state: 'removed' }],
    ]);
    await makeService().ensureCurrentMembership(userId, new Date());
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'student', student_experience: 'rookie' }),
    );
  });

  it('does not recreate an existing removed membership or overwrite a correction', async () => {
    const corrected = membership({ role: 'student_leader', student_experience: 'veteran' });
    const { tx } = setupTransaction([[corrected]]);
    await expect(makeService().ensureCurrentMembership(userId, new Date())).resolves.toEqual(
      corrected,
    );
    expect(admission.verify).not.toHaveBeenCalled();
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('returns the winner when another request inserts the same season membership first', async () => {
    const winner = membership({ role: 'student_leader', student_experience: 'veteran' });
    const { tx } = setupTransaction([[], [{ discordId }], [], [], [winner]], []);
    await expect(makeService().ensureCurrentMembership(userId, new Date())).resolves.toEqual(
      winner,
    );
    expect(tx.insert).toHaveBeenCalledOnce();
  });

  it('returns only the signed-in user membership for the current season', async () => {
    const own = membership();
    database.select
      .mockReturnValueOnce(builder([{ id: currentSeason.id }]))
      .mockReturnValueOnce(builder([own]));
    await expect(makeService().getOwnCurrent(userId, new Date())).resolves.toEqual(own);
  });

  it.each([
    ['denied', ForbiddenException],
    ['unavailable', ServiceUnavailableException],
  ] as const)('does not enroll when Discord admission is %s', async (result, exception) => {
    admission.verify.mockResolvedValue(result);
    const { tx } = setupTransaction([[], [{ discordId }]]);
    await expect(makeService().ensureCurrentMembership(userId, new Date())).rejects.toBeInstanceOf(
      exception,
    );
    expect(tx.insert).not.toHaveBeenCalled();
  });
});
