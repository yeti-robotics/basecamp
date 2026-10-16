import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SeasonsService } from './seasons.service.js';

function query(rows: unknown[]) {
  const builder = {
    from: vi.fn(() => builder),
    where: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    limit: vi.fn().mockResolvedValue(rows),
  };
  return builder;
}

const database = { transaction: vi.fn(), select: vi.fn() };
const authorization = { accessFor: vi.fn() };
const bootstrap = { bootstrapDiscordIdForUser: vi.fn(), completeFirstSeasonInTransaction: vi.fn() };
const season = {
  id: 4,
  name: '2027–28',
  startsOn: '2027-05-15',
  endsOn: '2028-05-14',
};

function makeService() {
  return new SeasonsService(
    { db: database } as never,
    new ConfigService({ BASECAMP_TIME_ZONE: 'America/New_York' }),
    authorization as never,
    bootstrap as never,
  );
}

function transaction(overlapping: unknown[] = []) {
  const returning = vi.fn().mockResolvedValue([season]);
  const insertValues = vi.fn().mockReturnValue({ returning });
  const tx = {
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn().mockReturnValue(query(overlapping)),
    insert: vi.fn(() => ({ values: insertValues, returning })),
    update: vi.fn(),
  };
  database.transaction.mockImplementation(async (callback: (tx: typeof tx) => unknown) =>
    callback(tx),
  );
  return { tx, returning, insertValues };
}

describe('SeasonsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorization.accessFor.mockResolvedValue({
      canManage: true,
      canView: true,
      canBootstrap: false,
    });
    bootstrap.bootstrapDiscordIdForUser.mockResolvedValue(null);
  });

  it('rejects invalid date ranges before opening a transaction', async () => {
    const service = makeService();
    await expect(
      service.create(
        { name: 'Broken season', startsOn: '2027-05-16', endsOn: '2027-05-15' },
        'admin',
      ),
    ).rejects.toThrow('End date must be on or after start date');
    expect(database.transaction).not.toHaveBeenCalled();
  });

  it('rejects overlapping date ranges inside a serialized transaction', async () => {
    const { tx } = transaction([{ id: 3 }]);
    await expect(
      makeService().create(
        { name: season.name, startsOn: season.startsOn, endsOn: season.endsOn },
        'admin',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.execute).toHaveBeenCalledOnce();
  });

  it('creates an adjacent season and keeps local midnight bounds in the legacy timestamps', async () => {
    const { tx, returning } = transaction([]);
    await expect(
      makeService().create(
        { name: season.name, startsOn: season.startsOn, endsOn: season.endsOn },
        'admin',
      ),
    ).resolves.toEqual(season);
    expect(returning).toHaveBeenCalledOnce();
    expect(tx.insert).toHaveBeenCalledTimes(2);
  });

  it('allows an authorized first-admin bootstrap to create the season in the same transaction', async () => {
    const { tx } = transaction([]);
    authorization.accessFor.mockResolvedValue({
      canManage: false,
      canView: false,
      canBootstrap: true,
    });
    bootstrap.bootstrapDiscordIdForUser.mockResolvedValue('123456789012345678');
    await makeService().create(
      { name: season.name, startsOn: season.startsOn, endsOn: season.endsOn },
      'bootstrap-user',
    );
    expect(bootstrap.completeFirstSeasonInTransaction).toHaveBeenCalledWith(
      tx,
      'bootstrap-user',
      season.id,
      '123456789012345678',
    );
  });

  it('rejects season creation without Team Admin or bootstrap authority', async () => {
    authorization.accessFor.mockResolvedValue({
      canManage: false,
      canView: true,
      canBootstrap: false,
    });
    await expect(
      makeService().create(
        { name: season.name, startsOn: season.startsOn, endsOn: season.endsOn },
        'mentor',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(database.transaction).not.toHaveBeenCalled();
  });
});
