import { describe, expect, it, vi } from 'vitest';
import type { AppDatabase } from '../database/database.service.js';
import { ensureSeasonMembership } from './ensure-season-membership.js';

function createDatabase(selectResults: Array<Array<{ id: number }>>) {
  const query = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
  };

  query.from.mockReturnValue(query);
  query.where.mockReturnValue(query);
  query.orderBy.mockReturnValue(query);
  query.limit.mockImplementation(async () => selectResults.shift() ?? []);

  const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn(() => ({ onConflictDoNothing }));
  const insert = vi.fn(() => ({ values }));

  const transaction = vi.fn(
    async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        select: vi.fn(() => query),
        insert,
      }),
  );

  return {
    database: { transaction } as unknown as AppDatabase,
    insert,
    values,
    onConflictDoNothing,
  };
}

describe('ensureSeasonMembership', () => {
  const userId = 'discord-user-1';
  const asOfDate = new Date('2026-10-15T12:00:00Z');

  it('creates a rookie student membership when the user has no membership history', async () => {
    const db = createDatabase([[{ id: 5 }], [], []]);

    await expect(
      ensureSeasonMembership(db.database, userId, asOfDate),
    ).resolves.toBe(true);

    expect(db.values).toHaveBeenCalledWith({
      season_id: 5,
      user_id: userId,
      role: 'student',
      student_experience: 'rookie',
    });
    expect(db.onConflictDoNothing).toHaveBeenCalled();
  });

  it('creates a veteran student membership when the user has previous membership history', async () => {
    const db = createDatabase([[{ id: 5 }], [], [{ id: 2 }]]);

    await expect(
      ensureSeasonMembership(db.database, userId, asOfDate),
    ).resolves.toBe(true);

    expect(db.values).toHaveBeenCalledWith({
      season_id: 5,
      user_id: userId,
      role: 'student',
      student_experience: 'veteran',
    });
  });

  it('does not change an existing membership for the active season', async () => {
    const db = createDatabase([[{ id: 5 }], [{ id: 10 }]]);

    await expect(
      ensureSeasonMembership(db.database, userId, asOfDate),
    ).resolves.toBe(true);

    expect(db.insert).not.toHaveBeenCalled();
  });

  it('returns false when there is no active season', async () => {
    const db = createDatabase([[]]);

    await expect(
      ensureSeasonMembership(db.database, userId, asOfDate),
    ).resolves.toBe(false);

    expect(db.insert).not.toHaveBeenCalled();
  });
});