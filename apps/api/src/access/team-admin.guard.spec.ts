import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SeasonAuthorizationService } from '../seasons/season-authorization.service.js';
import { TeamAdminGuard } from './team-admin.guard.js';

function executionContext(request: object) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

describe('TeamAdminGuard', () => {
  const accessFor = vi.fn();
  const guard = new TeamAdminGuard({ accessFor } as unknown as SeasonAuthorizationService);

  beforeEach(() => vi.clearAllMocks());

  it('requires the identity attached by SessionGuard', async () => {
    await expect(guard.canActivate(executionContext({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(accessFor).not.toHaveBeenCalled();
  });

  it('rejects users without effective Team Admin access', async () => {
    accessFor.mockResolvedValue({ canManage: false, canView: true, canBootstrap: false });
    await expect(
      guard.canActivate(executionContext({ authUserId: 'member-1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(accessFor).toHaveBeenCalledWith('member-1');
  });

  it('allows an effective active Team Admin', async () => {
    accessFor.mockResolvedValue({ canManage: true, canView: true, canBootstrap: false });
    await expect(guard.canActivate(executionContext({ authUserId: 'admin-1' }))).resolves.toBe(
      true,
    );
  });
});
