import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessService } from './access.service.js';

const database = { db: { select: vi.fn(), transaction: vi.fn() } };
const suspendedMember = { id: 'member-1', banned: true };
const currentSeason = { id: 4, startsOn: '2026-05-15', endsOn: '2027-05-14' };

function query(rows: unknown[]) {
  const result = {
    from: vi.fn(() => result),
    innerJoin: vi.fn(() => result),
    where: vi.fn(() => result),
    orderBy: vi.fn(() => Promise.resolve(rows)),
    limit: vi.fn().mockResolvedValue(rows),
    // biome-ignore lint/suspicious/noThenProperty: Drizzle queries are awaitable thenables.
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
  };
  return result;
}

function makeService() {
  return new AccessService(
    database as never,
    new ConfigService({ BASECAMP_TIME_ZONE: 'America/Los_Angeles' }),
  );
}

function makeAuthorizedService() {
  const service = makeService();
  vi.spyOn(service, 'assertTeamAdmin').mockResolvedValue(undefined);
  return service;
}

describe('AccessService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports whether a local account is suspended', async () => {
    database.db.select.mockReturnValue(query([suspendedMember]));
    await expect(makeService().isSuspended('member-1')).resolves.toBe(true);
    database.db.select.mockReturnValue(query([{ ...suspendedMember, banned: false }]));
    await expect(makeService().isSuspended('member-1')).resolves.toBe(false);
  });

  it('allows only an unsuspended active Team Admin in the locked transaction', async () => {
    const service = makeService();
    const tx = { select: vi.fn() } as never;
    const select = (tx as { select: ReturnType<typeof vi.fn> }).select;
    select
      .mockReturnValueOnce(query([{ banned: false }]))
      .mockReturnValueOnce(query([currentSeason]))
      .mockReturnValueOnce(query([{ role: 'team_admin', state: 'active' }]));
    await expect(
      service.assertTeamAdmin(tx, 'admin-1', new Date('2026-08-01T12:00:00Z')),
    ).resolves.toBeUndefined();

    select
      .mockReturnValueOnce(query([{ banned: true }]))
      .mockReturnValueOnce(query([currentSeason]))
      .mockReturnValueOnce(query([{ role: 'team_admin', state: 'active' }]));
    await expect(
      service.assertTeamAdmin(tx, 'admin-1', new Date('2026-08-01T12:00:00Z')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('suspends an account, records the reason, and revokes sessions transactionally', async () => {
    const insertedAudit = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) });
    const tx = {
      execute: vi.fn().mockResolvedValue(undefined),
      select: vi
        .fn()
        .mockReturnValueOnce(query([{ id: 'member-2', banned: false }]))
        .mockReturnValueOnce(query([currentSeason]))
        .mockReturnValueOnce(
          query([
            { userId: 'admin-1', seasonId: 4, role: 'team_admin', state: 'active', banned: false },
            { userId: 'member-2', seasonId: 4, role: 'student', state: 'active', banned: true },
          ]),
        ),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      })),
      delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      insert: vi.fn(() => ({ values: insertedAudit.mockImplementation(values) })),
    };
    database.db.transaction.mockImplementation(async (callback: (tx: typeof tx) => unknown) =>
      callback(tx),
    );

    await expect(
      makeAuthorizedService().suspend('admin-1', 'member-2', 'No longer on the team'),
    ).resolves.toBeUndefined();
    expect(tx.execute).toHaveBeenCalledOnce();
    expect(tx.update).toHaveBeenCalledOnce();
    expect(tx.delete).toHaveBeenCalledOnce();
    expect(insertedAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_user_id: 'admin-1',
        subject_user_id: 'member-2',
        action: 'account_suspended',
        reason: 'No longer on the team',
      }),
    );
  });

  it('rejects suspension that would leave no effective Team Admin', async () => {
    const tx = {
      execute: vi.fn().mockResolvedValue(undefined),
      select: vi
        .fn()
        .mockReturnValueOnce(query([{ id: 'admin-1', banned: false }]))
        .mockReturnValueOnce(query([currentSeason]))
        .mockReturnValueOnce(
          query([
            { userId: 'admin-1', seasonId: 4, role: 'team_admin', state: 'active', banned: true },
          ]),
        ),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      })),
      delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      insert: vi.fn(),
    };
    database.db.transaction.mockImplementation(async (callback: (tx: typeof tx) => unknown) =>
      callback(tx),
    );
    await expect(makeAuthorizedService().suspend('admin-1', 'admin-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('counts a prior active admin with no current-season row as an effective admin', async () => {
    const previousSeason = { id: 3, startsOn: '2025-05-15', endsOn: '2026-05-14' };
    const values = vi.fn().mockResolvedValue(undefined);
    const tx = {
      execute: vi.fn().mockResolvedValue(undefined),
      select: vi
        .fn()
        .mockReturnValueOnce(query([{ id: 'member-2', banned: false }]))
        .mockReturnValueOnce(query([currentSeason, previousSeason]))
        .mockReturnValueOnce(query([]))
        .mockReturnValueOnce(
          query([
            { userId: 'admin-1', seasonId: 3, role: 'team_admin', state: 'active', banned: false },
          ]),
        ),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      })),
      delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      insert: vi.fn(() => ({ values })),
    };
    database.db.transaction.mockImplementation(async (callback: (tx: typeof tx) => unknown) =>
      callback(tx),
    );
    await expect(makeAuthorizedService().suspend('admin-1', 'member-2')).resolves.toBeUndefined();
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ action: 'account_suspended' }));
  });

  it('rejects suspension for a user id that does not exist', async () => {
    const tx = {
      execute: vi.fn().mockResolvedValue(undefined),
      select: vi.fn().mockReturnValue(query([])),
      update: vi.fn(),
      delete: vi.fn(),
      insert: vi.fn(),
    };
    database.db.transaction.mockImplementation(async (callback: (tx: typeof tx) => unknown) =>
      callback(tx),
    );
    await expect(makeAuthorizedService().suspend('admin-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('restores account access and records the account-wide change', async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const tx = {
      execute: vi.fn().mockResolvedValue(undefined),
      select: vi.fn().mockReturnValue(query([{ id: 'member-2', banned: true }])),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      })),
      insert: vi.fn(() => ({ values })),
    };
    database.db.transaction.mockImplementation(async (callback: (tx: typeof tx) => unknown) =>
      callback(tx),
    );
    await expect(makeAuthorizedService().restore('admin-1', 'member-2')).resolves.toBeUndefined();
    expect(tx.update).toHaveBeenCalledOnce();
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'account_restored',
        before: { banned: true },
        after: { banned: false },
      }),
    );
  });
});
