import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BootstrapService } from './bootstrap.service.js';

const discordId = '123456789012345678';
const database = {
  select: vi.fn(),
  transaction: vi.fn(),
};
const admission = { verifyWithAdmissionBot: vi.fn() };

function query(rows: unknown[]) {
  const builder = {
    from: vi.fn(() => builder),
    where: vi.fn(() => builder),
    limit: vi.fn().mockResolvedValue(rows),
  };
  return builder;
}

function makeService(ids = discordId) {
  return new BootstrapService(
    { db: database } as never,
    new ConfigService({ BASECAMP_BOOTSTRAP_ADMIN_DISCORD_IDS: ids }),
    admission as never,
  );
}

describe('BootstrapService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    admission.verifyWithAdmissionBot.mockResolvedValue('allowed');
  });

  it('allows a configured, admitted Discord identity only while no Team Admin exists', async () => {
    database.select
      .mockReturnValueOnce(query([{ accountId: discordId }]))
      .mockReturnValueOnce(query([]));

    await expect(makeService().mayCreateFirstSeason('user-1', discordId)).resolves.toBe(true);
    expect(admission.verifyWithAdmissionBot).toHaveBeenCalledWith(discordId);
    expect(database.select).toHaveBeenCalledTimes(2);
  });

  it('rejects an arbitrary Discord identity without querying or granting bootstrap authority', async () => {
    await expect(makeService().mayCreateFirstSeason('user-1', '999999999999999999')).resolves.toBe(
      false,
    );
    expect(database.select).not.toHaveBeenCalled();
    expect(admission.verifyWithAdmissionBot).not.toHaveBeenCalled();
  });

  it('rejects a configured identity that fails guild admission', async () => {
    admission.verifyWithAdmissionBot.mockResolvedValue('denied');
    await expect(makeService().mayCreateFirstSeason('user-1', discordId)).resolves.toBe(false);
    expect(database.select).not.toHaveBeenCalled();
  });

  it('does not grant bootstrap authority after a Team Admin membership exists', async () => {
    database.select
      .mockReturnValueOnce(query([{ accountId: discordId }]))
      .mockReturnValueOnce(query([{ id: 5 }]));

    await expect(makeService().mayCreateFirstSeason('user-1', discordId)).resolves.toBe(false);
  });

  it('creates the first Team Admin membership and audit row in one transaction', async () => {
    const insertValues = vi.fn().mockResolvedValue(undefined);
    const tx = {
      execute: vi.fn().mockResolvedValue(undefined),
      select: vi
        .fn()
        .mockReturnValueOnce(query([{ id: 'account-1' }]))
        .mockReturnValueOnce(query([])),
      insert: vi.fn(() => ({ values: insertValues })),
    };
    database.select
      .mockReturnValueOnce(query([]))
      .mockReturnValueOnce(query([]))
      .mockReturnValueOnce(query([{ discordId }]));
    database.transaction.mockImplementation(async (callback: (transaction: typeof tx) => unknown) =>
      callback(tx),
    );

    await expect(makeService().completeFirstSeason('user-1', 12)).resolves.toBeUndefined();
    expect(database.transaction).toHaveBeenCalledOnce();
    expect(tx.execute).toHaveBeenCalledOnce();
    expect(tx.insert).toHaveBeenCalledTimes(2);
    expect(insertValues).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        season_id: 12,
        user_id: 'user-1',
        role: 'team_admin',
        state: 'active',
      }),
    );
    expect(insertValues).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        actor_user_id: 'user-1',
        subject_user_id: 'user-1',
        action: 'bootstrap_admin',
      }),
    );
  });

  it('refuses to bootstrap when a Team Admin already exists', async () => {
    database.select.mockReturnValueOnce(query([{ id: 5 }]));
    const tx = {
      execute: vi.fn().mockResolvedValue(undefined),
      select: vi.fn().mockReturnValue(query([{ id: 5 }])),
      insert: vi.fn(),
    };
    database.transaction.mockImplementation(async (callback: (transaction: typeof tx) => unknown) =>
      callback(tx),
    );

    await expect(makeService().completeFirstSeason('user-1', 12)).rejects.toThrow(
      'A Team Admin already exists',
    );
    expect(tx.insert).not.toHaveBeenCalled();
  });
});
