import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberContextService } from './member-context.service.js';

const auth = { api: { getSession: vi.fn() } };
const roster = { ensureCurrentMembership: vi.fn() };

function makeService() {
  return new MemberContextService(auth as never, roster as never);
}

describe('MemberContextService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.api.getSession.mockResolvedValue({ user: { id: 'member-1' } });
    roster.ensureCurrentMembership.mockResolvedValue(null);
  });

  it('ensures the current season membership for a session that remains active across rollover', async () => {
    await expect(makeService().authenticate({ cookie: 'session=test' })).resolves.toBe('member-1');
    expect(roster.ensureCurrentMembership).toHaveBeenCalledWith('member-1', expect.any(Date));
    expect(auth.api.getSession.mock.calls[0][0].headers.get('cookie')).toBe('session=test');
  });

  it('still authenticates a member when no season is current', async () => {
    roster.ensureCurrentMembership.mockResolvedValue(null);
    await expect(makeService().authenticate({})).resolves.toBe('member-1');
  });

  it('rejects missing sessions before attempting enrollment', async () => {
    auth.api.getSession.mockResolvedValue(null);
    await expect(makeService().authenticate({})).rejects.toBeInstanceOf(UnauthorizedException);
    expect(roster.ensureCurrentMembership).not.toHaveBeenCalled();
  });
});
