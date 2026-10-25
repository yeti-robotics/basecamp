import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SeasonAuthorizationService } from './season-authorization.service.js';

const select = vi.fn();
const bootstrap = { bootstrapDiscordIdForUser: vi.fn() };
const current = { id: 2, startsOn: '2026-05-15', endsOn: '2027-05-14' };
const previous = { id: 1, startsOn: '2025-05-15', endsOn: '2026-05-14' };

function query(rows: unknown[]) {
  const builder = {
    from: vi.fn(() => builder),
    where: vi.fn(() => builder),
    orderBy: vi.fn(() => Promise.resolve(rows)),
    limit: vi.fn().mockResolvedValue(rows),
  };
  return builder;
}

function makeService() {
  return new SeasonAuthorizationService(
    { db: { select } } as never,
    bootstrap as never,
    new ConfigService({ BASECAMP_TIME_ZONE: 'America/Los_Angeles' }),
  );
}

describe('SeasonAuthorizationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bootstrap.bootstrapDiscordIdForUser.mockResolvedValue(null);
  });

  it('retains admin access for the prior admin while the new season membership is not created yet', async () => {
    select
      .mockReturnValueOnce(query([current, previous]))
      .mockReturnValueOnce(query([]))
      .mockReturnValueOnce(query([{ role: 'team_admin', state: 'active' }]));
    await expect(makeService().accessFor('user-1')).resolves.toEqual({
      canView: true,
      canManage: true,
      canManageAttendance: true,
      canBootstrap: false,
    });
  });

  it('does not fall back when the current season explicitly marks a user removed', async () => {
    select
      .mockReturnValueOnce(query([current, previous]))
      .mockReturnValueOnce(query([{ role: 'team_admin', state: 'removed' }]));
    await expect(makeService().accessFor('user-1')).resolves.toEqual({
      canView: false,
      canManage: false,
      canManageAttendance: false,
      canBootstrap: false,
    });
    expect(select).toHaveBeenCalledTimes(2);
  });

  it('allows mentors to view season history and manage attendance without managing seasons', async () => {
    select
      .mockReturnValueOnce(query([previous]))
      .mockReturnValueOnce(query([{ role: 'mentor', state: 'active' }]));
    await expect(makeService().accessFor('user-1')).resolves.toEqual({
      canView: true,
      canManage: false,
      canManageAttendance: true,
      canBootstrap: false,
    });
  });

  it('does not give bootstrap-only users permission to manage attendance', async () => {
    bootstrap.bootstrapDiscordIdForUser.mockResolvedValue('123456789012345678');
    select
      .mockReturnValueOnce(query([]))
      .mockReturnValueOnce(query([]));
    const service = makeService();

    await expect(service.accessFor('user-1')).resolves.toEqual({
      canView: true,
      canManage: false,
      canManageAttendance: false,
      canBootstrap: true,
    });
    await expect(service.canManageAttendance('user-1')).resolves.toBe(false);
  });
});