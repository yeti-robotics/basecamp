import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { DiscordAdmissionService } from './discord-admission.service.js';

const settings = {
  DISCORD_GUILD_ID: '408711970305474560',
};
const discordId = '123456789012345678';
const userAccessToken = 'discord-user-access-token';

function makeService(fetcher: typeof fetch = vi.fn(), timeoutMs = 5_000) {
  return new DiscordAdmissionService(new ConfigService(settings), fetcher, timeoutMs);
}

describe('DiscordAdmissionService', () => {
  it('checks the signing-in user with their OAuth token', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user: { id: discordId } }),
    });

    await expect(makeService(fetcher).verify(userAccessToken, discordId)).resolves.toBe('allowed');
    expect(fetcher).toHaveBeenCalledWith(
      `https://discord.com/api/v10/users/@me/guilds/${settings.DISCORD_GUILD_ID}/member`,
      expect.objectContaining({
        headers: { Authorization: `Bearer ${userAccessToken}` },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('preserves bot-token admission for existing season callers until they migrate', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user: { id: discordId } }),
    });
    const service = new DiscordAdmissionService(
      new ConfigService({
        ...settings,
        DISCORD_ADMISSION_BOT_TOKEN: 'legacy-admission-token',
      }),
      fetcher,
    );

    await expect(service.verifyWithAdmissionBot(discordId)).resolves.toBe('allowed');
    expect(fetcher).toHaveBeenCalledWith(
      `https://discord.com/api/v10/guilds/${settings.DISCORD_GUILD_ID}/members/${discordId}`,
      expect.objectContaining({
        headers: { Authorization: 'Bot legacy-admission-token' },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('denies an identity that is not a member of the configured guild', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    await expect(makeService(fetcher).verify(userAccessToken, discordId)).resolves.toBe('denied');
  });

  it('fails closed when Discord is unavailable', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(makeService(fetcher).verify(userAccessToken, discordId)).resolves.toBe(
      'unavailable',
    );
  });

  it('fails closed when the membership response is malformed', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    await expect(makeService(fetcher).verify(userAccessToken, discordId)).resolves.toBe(
      'unavailable',
    );
  });

  it('fails closed when Discord returns invalid JSON', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('invalid JSON');
      },
    });
    await expect(makeService(fetcher).verify(userAccessToken, discordId)).resolves.toBe(
      'unavailable',
    );
  });

  it('fails closed when Discord reports another user in the membership response', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user: { id: '987654321098765432' } }),
    });
    await expect(makeService(fetcher).verify(userAccessToken, discordId)).resolves.toBe(
      'unavailable',
    );
  });

  it.each([401, 403, 429, 500])('fails closed for Discord status %i', async (status) => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status });
    await expect(makeService(fetcher).verify(userAccessToken, discordId)).resolves.toBe(
      'unavailable',
    );
  });

  it('uses an explicit timeout and returns unavailable when the request times out', async () => {
    const fetcher = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
      });
    });

    await expect(makeService(fetcher, 1).verify(userAccessToken, discordId)).resolves.toBe(
      'unavailable',
    );
  });

  it('denies malformed Discord identities without making a request', async () => {
    const fetcher = vi.fn();
    await expect(makeService(fetcher).verify(userAccessToken, 'not-a-snowflake')).resolves.toBe(
      'denied',
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('returns unavailable when admission configuration is missing', async () => {
    const service = new DiscordAdmissionService(new ConfigService({}), vi.fn());
    await expect(service.verify(userAccessToken, discordId)).resolves.toBe('unavailable');
  });

  it('does not make a request without the user access token', async () => {
    const fetcher = vi.fn();
    await expect(makeService(fetcher).verify('', discordId)).resolves.toBe('unavailable');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
