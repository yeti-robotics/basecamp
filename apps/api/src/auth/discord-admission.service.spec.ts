import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { DiscordAdmissionService } from './discord-admission.service.js';

const settings = {
  DISCORD_GUILD_ID: '408711970305474560',
  DISCORD_ADMISSION_BOT_TOKEN: 'bot-secret',
};
const discordId = '123456789012345678';

function makeService(fetcher: typeof fetch = vi.fn(), timeoutMs = 5_000) {
  return new DiscordAdmissionService(new ConfigService(settings), fetcher, timeoutMs);
}

describe('DiscordAdmissionService', () => {
  it('allows a verified member from the configured guild', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user: { id: discordId } }),
    });

    await expect(makeService(fetcher).verify(discordId)).resolves.toBe('allowed');
    expect(fetcher).toHaveBeenCalledWith(
      `https://discord.com/api/v10/guilds/${settings.DISCORD_GUILD_ID}/members/${discordId}`,
      expect.objectContaining({
        headers: { Authorization: `Bot ${settings.DISCORD_ADMISSION_BOT_TOKEN}` },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('denies an identity that is not a member of the configured guild', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    await expect(makeService(fetcher).verify(discordId)).resolves.toBe('denied');
  });

  it('fails closed when Discord is unavailable', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(makeService(fetcher).verify(discordId)).resolves.toBe('unavailable');
  });

  it('fails closed when the membership response is malformed', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    await expect(makeService(fetcher).verify(discordId)).resolves.toBe('unavailable');
  });

  it('uses an explicit timeout and returns unavailable when the request times out', async () => {
    const fetcher = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
      });
    });

    await expect(makeService(fetcher, 1).verify(discordId)).resolves.toBe('unavailable');
  });

  it('denies malformed Discord identities without making a request', async () => {
    const fetcher = vi.fn();
    await expect(makeService(fetcher).verify('not-a-snowflake')).resolves.toBe('denied');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('returns unavailable when admission configuration is missing', async () => {
    const service = new DiscordAdmissionService(new ConfigService({}), vi.fn());
    await expect(service.verify(discordId)).resolves.toBe('unavailable');
  });
});
