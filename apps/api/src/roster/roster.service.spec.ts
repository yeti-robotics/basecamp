import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RosterService } from './roster.service.js';

const currentSeason = { id: 4, name: '2027–28', startsOn: '2027-05-15', endsOn: '2028-05-14' };
const userId = 'member-1';
const discordId = '123456789012345678';
const admission = { verifyWithAdmissionBot: vi.fn() };
const access = { assertEffectiveAdminRemains: vi.fn(), assertTeamAdmin: vi.fn() };
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
    access as never,
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

function setupMutationTransaction(queries: unknown[][], updated = membership()) {
  const updateSet = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([updated]) }),
  });
  const insertValues = vi.fn().mockResolvedValue(undefined);
  const tx = {
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn(() => builder(queries.shift() ?? [])),
    update: vi.fn(() => ({ set: updateSet })),
    insert: vi.fn(() => ({ values: insertValues })),
  };
  database.transaction.mockImplementation(async (callback: (tx: typeof tx) => unknown) =>
    callback(tx),
  );
  return { tx, updateSet, insertValues };
}

describe('RosterService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.select.mockReturnValue(builder([currentSeason]));
    admission.verifyWithAdmissionBot.mockResolvedValue('allowed');
    access.assertEffectiveAdminRemains.mockResolvedValue(undefined);
    access.assertTeamAdmin.mockResolvedValue(undefined);
  });

  it('returns null without a current season and does not check Discord or write', async () => {
    database.select.mockReturnValue(builder([]));
    await expect(makeService().ensureCurrentMembership(userId, new Date())).resolves.toBeNull();
    expect(database.transaction).not.toHaveBeenCalled();
    expect(admission.verifyWithAdmissionBot).not.toHaveBeenCalled();
  });

  it('creates a new member as Student/Rookie after verifying their linked Discord identity', async () => {
    const { tx, insertValues } = setupTransaction([[], [{ discordId }], []]);
    await makeService().ensureCurrentMembership(userId, new Date('2027-06-01T12:00:00Z'));
    expect(admission.verifyWithAdmissionBot).toHaveBeenCalledWith(discordId);
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
    expect(admission.verifyWithAdmissionBot).not.toHaveBeenCalled();
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

  it('allows a Mentor correction without student experience and records before/after audit', async () => {
    const before = membership({ role: 'student', student_experience: 'veteran' });
    const updated = membership({ role: 'mentor', student_experience: null });
    const { tx, updateSet, insertValues } = setupMutationTransaction(
      [[{ id: currentSeason.id }], [before]],
      updated,
    );
    await expect(
      makeService().updateCurrentMember(
        15,
        { role: 'mentor' },
        'admin-1',
        new Date('2027-10-01T12:00:00Z'),
      ),
    ).resolves.toEqual(updated);
    expect(updateSet).toHaveBeenCalledWith({ role: 'mentor', student_experience: null });
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_user_id: 'admin-1',
        subject_user_id: userId,
        action: 'membership_updated',
        before: expect.objectContaining({ role: 'student', studentExperience: 'veteran' }),
        after: expect.objectContaining({ role: 'mentor', studentExperience: null }),
      }),
    );
    expect(tx.execute).toHaveBeenCalledOnce();
    expect(access.assertTeamAdmin).toHaveBeenCalledWith(
      tx,
      'admin-1',
      new Date('2027-10-01T12:00:00Z'),
    );
  });

  it('requires experience for student roles and protects the last effective admin', async () => {
    const service = makeService();
    await expect(
      service.updateCurrentMember(15, { role: 'student' }, 'admin-1', new Date()),
    ).rejects.toBeInstanceOf(BadRequestException);

    const before = membership({ role: 'team_admin', student_experience: null });
    const { tx, insertValues } = setupMutationTransaction(
      [[{ id: currentSeason.id }], [before]],
      membership({ role: 'student', student_experience: 'rookie' }),
    );
    access.assertEffectiveAdminRemains.mockRejectedValueOnce(new ConflictException());
    await expect(
      makeService().updateCurrentMember(
        15,
        { role: 'student', studentExperience: 'rookie' },
        'admin-1',
        new Date('2027-10-01T12:00:00Z'),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.update).toHaveBeenCalledOnce();
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('removes and restores only the current season membership with audit records', async () => {
    const before = membership();
    const removed = membership({ state: 'removed', removed_at: new Date(), ended_at: new Date() });
    const first = setupMutationTransaction([[{ id: currentSeason.id }], [before]], removed);
    await expect(
      makeService().removeCurrentMember(15, 'admin-1', 'No longer attending', new Date()),
    ).resolves.toEqual(removed);
    expect(first.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'removed',
        removed_at: expect.any(Date),
        ended_at: expect.any(Date),
      }),
    );
    expect(first.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'membership_removed', reason: 'No longer attending' }),
    );

    const restored = membership();
    const second = setupMutationTransaction([[{ id: currentSeason.id }], [removed]], restored);
    await expect(makeService().restoreCurrentMember(15, 'admin-1', new Date())).resolves.toEqual(
      restored,
    );
    expect(second.updateSet).toHaveBeenCalledWith({
      state: 'active',
      removed_at: null,
      ended_at: null,
    });
    expect(second.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'membership_restored' }),
    );
  });

  it('does not remove the only effective Team Admin', async () => {
    const admin = membership({ role: 'team_admin', student_experience: null });
    const { tx, insertValues } = setupMutationTransaction(
      [[{ id: currentSeason.id }], [admin]],
      membership({ role: 'team_admin', student_experience: null, state: 'removed' }),
    );
    access.assertEffectiveAdminRemains.mockRejectedValueOnce(new ConflictException());
    await expect(
      makeService().removeCurrentMember(15, 'admin-1', undefined, new Date('2027-10-01T12:00:00Z')),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.update).toHaveBeenCalledOnce();
    expect(insertValues).not.toHaveBeenCalled();
  });

  it.each([
    ['denied', ForbiddenException],
    ['unavailable', ServiceUnavailableException],
  ] as const)('does not enroll when Discord admission is %s', async (result, exception) => {
    admission.verifyWithAdmissionBot.mockResolvedValue(result);
    const { tx } = setupTransaction([[], [{ discordId }]]);
    await expect(makeService().ensureCurrentMembership(userId, new Date())).rejects.toBeInstanceOf(
      exception,
    );
    expect(tx.insert).not.toHaveBeenCalled();
  });
});
