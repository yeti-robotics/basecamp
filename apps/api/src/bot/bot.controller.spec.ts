import { describe, expect, it, vi } from 'vitest';
import { BotController } from './bot.controller.js';
import type { BotRuntimeService } from './bot-runtime.service.js';

describe('BotController', () => {
  const status = {
    desiredEnabled: true,
    tokenConfigured: true,
    connection: 'connected',
  } as const;

  it('returns only safe runtime status', async () => {
    const runtime = { status: vi.fn().mockResolvedValue(status) } as unknown as BotRuntimeService;
    const controller = new BotController(runtime);
    await expect(controller.getStatus()).resolves.toEqual(status);
  });

  it('routes token and enabled changes through runtime without returning secrets', async () => {
    const runtime = {
      status: vi.fn().mockResolvedValue(status),
      replaceToken: vi.fn().mockResolvedValue(status),
      setEnabled: vi.fn().mockResolvedValue(status),
    } as unknown as BotRuntimeService;
    const controller = new BotController(runtime);
    const tokenResponse = { setHeader: vi.fn() };
    const enabledResponse = { setHeader: vi.fn() };

    await expect(
      controller.setToken({ token: 'secret-token' }, tokenResponse as never),
    ).resolves.toEqual(status);
    await expect(
      controller.setEnabled({ enabled: false }, enabledResponse as never),
    ).resolves.toEqual(status);
    expect(runtime.replaceToken).toHaveBeenCalledWith('secret-token');
    expect(runtime.setEnabled).toHaveBeenCalledWith(false);
    expect(JSON.stringify([status, tokenResponse, enabledResponse])).not.toContain('secret-token');
  });
});
