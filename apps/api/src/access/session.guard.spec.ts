import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Auth } from '../auth.js';
import { AccessService } from './access.service.js';
import { SessionGuard } from './session.guard.js';

function executionContext(request: object) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

describe('SessionGuard', () => {
  const getSession = vi.fn();
  const isSuspended = vi.fn();
  let guard: SessionGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new SessionGuard(
      { api: { getSession } } as unknown as Auth,
      { isSuspended } as unknown as AccessService,
    );
  });

  it('rejects a missing session', async () => {
    getSession.mockResolvedValue(null);
    await expect(guard.canActivate(executionContext({ headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects suspended accounts and does not attach their identity', async () => {
    getSession.mockResolvedValue({ user: { id: 'suspended-user' } });
    isSuspended.mockResolvedValue(true);
    const request = { headers: {} };
    await expect(guard.canActivate(executionContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(request).not.toHaveProperty('authUserId');
  });

  it('attaches only the authenticated user ID to the request', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1', role: 'admin', email: 'a@b.test' } });
    isSuspended.mockResolvedValue(false);
    const request = { headers: {}, authUserId: 'forged' };
    await expect(guard.canActivate(executionContext(request))).resolves.toBe(true);
    expect(request).toEqual({ headers: {}, authUserId: 'user-1' });
    expect(getSession).toHaveBeenCalledOnce();
  });
});
