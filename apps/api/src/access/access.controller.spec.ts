import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessController } from './access.controller.js';

const auth = { api: { getSession: vi.fn() } };
const access = { isSuspended: vi.fn(), suspend: vi.fn(), restore: vi.fn() };
const authorization = { accessFor: vi.fn() };
const request = { headers: { cookie: 'session=test' } } as never;

function makeController() {
  return new AccessController(auth as never, access as never, authorization as never);
}

describe('AccessController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.api.getSession.mockResolvedValue({ user: { id: 'admin-1' } });
    access.isSuspended.mockResolvedValue(false);
    authorization.accessFor.mockResolvedValue({ canManage: true });
  });

  it('requires an active Team Admin to suspend and restore accounts', async () => {
    authorization.accessFor.mockResolvedValue({ canManage: false });
    await expect(makeController().suspend(request, 'member-1', {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(makeController().restore(request, 'member-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(access.suspend).not.toHaveBeenCalled();
    expect(access.restore).not.toHaveBeenCalled();
  });

  it('records account actions as account-wide mutations', async () => {
    await expect(
      makeController().suspend(request, 'member-1', { reason: 'Left the team' }),
    ).resolves.toEqual({ userId: 'member-1', suspended: true });
    await expect(makeController().restore(request, 'member-1')).resolves.toEqual({
      userId: 'member-1',
      suspended: false,
    });
    expect(access.suspend).toHaveBeenCalledWith('admin-1', 'member-1', 'Left the team');
    expect(access.restore).toHaveBeenCalledWith('admin-1', 'member-1');
  });

  it('rejects a suspended actor session', async () => {
    access.isSuspended.mockResolvedValue(true);
    await expect(makeController().suspend(request, 'member-1', {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
