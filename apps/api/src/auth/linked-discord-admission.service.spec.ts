import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LinkedDiscordAdmissionService } from './linked-discord-admission.service.js';

const userId = 'user-1';
const discordId = '123456789012345678';
const accessToken = 'refreshed-discord-access-token';
const database = { select: vi.fn() };
const auth = { api: { getAccessToken: vi.fn() } };
const admission = { verify: vi.fn() };

function accountQuery(rows: unknown[]) {
  const query = {
    from: vi.fn(() => query),
    where: vi.fn(() => query),
    limit: vi.fn().mockResolvedValue(rows),
  };
  return query;
}

function makeService() {
  return new LinkedDiscordAdmissionService(
    { db: database } as never,
    auth as never,
    admission as never,
  );
}

describe('LinkedDiscordAdmissionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.select.mockReturnValue(accountQuery([{ id: 'account-1' }]));
    auth.api.getAccessToken.mockResolvedValue({
      accessToken,
      scopes: ['identify', 'guilds.members.read'],
    });
    admission.verify.mockResolvedValue('allowed');
  });

  it('refreshes the exact user-linked Discord account and checks its guild membership', async () => {
    await expect(makeService().verifyLinked(userId, discordId)).resolves.toBe('allowed');
    expect(auth.api.getAccessToken).toHaveBeenCalledWith({
      body: { accountId: 'account-1', userId },
    });
    expect(admission.verify).toHaveBeenCalledWith(accessToken, discordId);
  });

  it('does not use an account belonging to a different user', async () => {
    database.select.mockReturnValue(accountQuery([]));

    await expect(makeService().verifyLinked(userId, discordId)).resolves.toBe('unavailable');
    expect(auth.api.getAccessToken).not.toHaveBeenCalled();
    expect(admission.verify).not.toHaveBeenCalled();
  });

  it('requires the OAuth membership scope before checking Discord', async () => {
    auth.api.getAccessToken.mockResolvedValue({ accessToken, scopes: ['identify'] });

    await expect(makeService().verifyLinked(userId, discordId)).resolves.toBe('unavailable');
    expect(admission.verify).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing access token', { scopes: ['guilds.members.read'] }],
    ['an expired or revoked token', new Error('refresh token revoked')],
  ])('fails closed for %s', async (_description, result) => {
    auth.api.getAccessToken.mockResolvedValue(result);
    if (result instanceof Error) auth.api.getAccessToken.mockRejectedValue(result);

    await expect(makeService().verifyLinked(userId, discordId)).resolves.toBe('unavailable');
    expect(admission.verify).not.toHaveBeenCalled();
  });

  it('preserves the Discord admission result', async () => {
    admission.verify.mockResolvedValue('denied');

    await expect(makeService().verifyLinked(userId, discordId)).resolves.toBe('denied');
  });

  it('fails closed when Discord cannot be reached', async () => {
    admission.verify.mockRejectedValue(new Error('request failed'));

    await expect(makeService().verifyLinked(userId, discordId)).resolves.toBe('unavailable');
  });
});
