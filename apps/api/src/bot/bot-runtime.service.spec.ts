import { BadRequestException, type INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActivityType } from 'discord.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BotContextFactory } from './bot-context.factory.js';
import { BotRuntimeService } from './bot-runtime.service.js';
import type { BotSettingsStore } from './bot-settings.store.js';
import type { BotTokenCipher } from './bot-token-cipher.js';

const token = 'bot-token';
const ciphertext = 'encrypted-bot-token';

function makeContext() {
  return { close: vi.fn().mockResolvedValue(undefined) } as unknown as INestApplicationContext;
}

describe('BotRuntimeService', () => {
  let settings: { enabled: boolean; tokenCiphertext: string | null; statusMessage: string };
  let store: {
    load: ReturnType<typeof vi.fn>;
    setEnabled: ReturnType<typeof vi.fn>;
    setToken: ReturnType<typeof vi.fn>;
    setStatusMessage: ReturnType<typeof vi.fn>;
  };
  let cipher: { encrypt: ReturnType<typeof vi.fn>; decrypt: ReturnType<typeof vi.fn> };
  let factory: { start: ReturnType<typeof vi.fn> };

  function makeService() {
    return new BotRuntimeService(
      store as unknown as BotSettingsStore,
      cipher as unknown as BotTokenCipher,
      factory as unknown as BotContextFactory,
      new ConfigService({ DISCORD_DEVELOPMENT_GUILD_ID: 'dev-guild' }, { skipProcessEnv: true }),
    );
  }

  async function flushStartup() {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  beforeEach(() => {
    settings = {
      enabled: false,
      tokenCiphertext: null,
      statusMessage: 'YETI ARE YOU READY?',
    };
    store = {
      load: vi.fn(async () => ({ ...settings })),
      setEnabled: vi.fn(async (enabled: boolean) => {
        settings.enabled = enabled;
      }),
      setToken: vi.fn(async (value: string) => {
        settings.tokenCiphertext = value;
      }),
      setStatusMessage: vi.fn(async (value: string) => {
        settings.statusMessage = value;
      }),
    };
    cipher = {
      encrypt: vi.fn(() => ciphertext),
      decrypt: vi.fn(() => token),
    };
    factory = { start: vi.fn().mockResolvedValue(makeContext()) };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not connect on a new installation', async () => {
    const service = makeService();
    await service.onApplicationBootstrap();
    await flushStartup();

    expect(factory.start).not.toHaveBeenCalled();
    await expect(service.status()).resolves.toEqual({
      desiredEnabled: false,
      tokenConfigured: false,
      connection: 'off',
      statusMessage: 'YETI ARE YOU READY?',
    });
  });

  it('saves a trimmed status message and updates a connected bot immediately', async () => {
    const setActivity = vi.fn();
    const context = {
      close: vi.fn().mockResolvedValue(undefined),
      get: vi.fn(() => ({ user: { setActivity } })),
    } as unknown as INestApplicationContext;
    factory.start.mockResolvedValue(context);
    const service = makeService();
    await service.onApplicationBootstrap();
    await service.replaceToken(token);
    await service.setEnabled(true);

    await service.setStatusMessage('  Scrimmage tonight  ');

    expect(store.setStatusMessage).toHaveBeenCalledWith('Scrimmage tonight');
    expect(setActivity).toHaveBeenCalledWith('Scrimmage tonight', { type: ActivityType.Custom });
    await expect(service.status()).resolves.toMatchObject({ statusMessage: 'Scrimmage tonight' });
  });

  it('rejects a blank status message before storing it', async () => {
    const service = makeService();
    await service.onApplicationBootstrap();

    await expect(service.setStatusMessage('   ')).rejects.toBeInstanceOf(BadRequestException);
    expect(store.setStatusMessage).not.toHaveBeenCalled();
  });

  it('keeps a saved disabled state off after restart even with a token configured', async () => {
    settings = { enabled: false, tokenCiphertext: ciphertext };
    const service = makeService();
    await service.onApplicationBootstrap();
    await flushStartup();

    expect(factory.start).not.toHaveBeenCalled();
    await expect(service.status()).resolves.toMatchObject({
      desiredEnabled: false,
      tokenConfigured: true,
      connection: 'off',
    });
  });

  it('starts once after restart when the saved state is enabled', async () => {
    settings = { enabled: true, tokenCiphertext: ciphertext };
    const service = makeService();
    await service.onApplicationBootstrap();
    await flushStartup();

    expect(factory.start).toHaveBeenCalledOnce();
    expect(factory.start).toHaveBeenCalledWith(
      token,
      'dev-guild',
      expect.any(AbortSignal),
      expect.any(Function),
    );
    await expect(service.status()).resolves.toMatchObject({ connection: 'connected' });
  });

  it('rejects enabling before a token is saved', async () => {
    const service = makeService();
    await service.onApplicationBootstrap();

    await expect(service.setEnabled(true)).rejects.toBeInstanceOf(BadRequestException);
    expect(store.setEnabled).not.toHaveBeenCalled();
  });

  it('persists enabled state before connecting and closes the context when disabled', async () => {
    const context = makeContext();
    factory.start.mockResolvedValue(context);
    const service = makeService();
    await service.onApplicationBootstrap();
    await service.replaceToken(token);
    await service.setEnabled(true);

    expect(store.setEnabled).toHaveBeenCalledWith(true);
    expect(factory.start).toHaveBeenCalledOnce();
    await service.setEnabled(false);
    expect(context.close).toHaveBeenCalledOnce();
    await expect(service.status()).resolves.toMatchObject({
      desiredEnabled: false,
      connection: 'off',
    });
  });

  it('restarts the context after replacing a token while enabled', async () => {
    const firstContext = makeContext();
    const nextContext = makeContext();
    factory.start.mockResolvedValueOnce(firstContext).mockResolvedValueOnce(nextContext);
    const service = makeService();
    await service.onApplicationBootstrap();
    await service.replaceToken(token);
    await service.setEnabled(true);

    cipher.encrypt.mockReturnValueOnce('new-ciphertext');
    cipher.decrypt.mockReturnValueOnce('new-token');
    await service.replaceToken('new-token');

    expect(firstContext.close).toHaveBeenCalledOnce();
    expect(factory.start).toHaveBeenNthCalledWith(
      2,
      'new-token',
      'dev-guild',
      expect.any(AbortSignal),
      expect.any(Function),
    );
    await expect(service.status()).resolves.toMatchObject({ connection: 'connected' });
  });

  it('serializes rapid state changes without leaving multiple contexts open', async () => {
    const firstContext = makeContext();
    const secondContext = makeContext();
    let releaseFirst!: (context: INestApplicationContext) => void;
    factory.start
      .mockImplementationOnce(
        () => new Promise<INestApplicationContext>((resolve) => (releaseFirst = resolve)),
      )
      .mockResolvedValueOnce(secondContext);
    const service = makeService();
    await service.onApplicationBootstrap();
    await service.replaceToken(token);
    const enabling = service.setEnabled(true);
    await vi.waitFor(() => expect(factory.start).toHaveBeenCalledOnce());
    const disabling = service.setEnabled(false);
    releaseFirst(firstContext);
    await Promise.all([enabling, disabling]);

    expect(firstContext.close).toHaveBeenCalledOnce();
    expect(factory.start).toHaveBeenCalledOnce();
    await expect(service.status()).resolves.toMatchObject({
      desiredEnabled: false,
      connection: 'off',
    });
  });

  it('cancels a pending login immediately when disabled', async () => {
    let receivedSignal: AbortSignal | undefined;
    factory.start.mockImplementationOnce(
      (_token: string, _guildId: string | undefined, signal: AbortSignal) => {
        receivedSignal = signal;
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('startup cancelled')));
        });
      },
    );
    const service = makeService();
    await service.onApplicationBootstrap();
    await service.replaceToken(token);
    const enabling = service.setEnabled(true);
    await vi.waitFor(() => expect(factory.start).toHaveBeenCalledOnce());

    await service.setEnabled(false);
    await enabling;

    expect(receivedSignal?.aborted).toBe(true);
    await expect(service.status()).resolves.toMatchObject({
      desiredEnabled: false,
      connection: 'off',
    });
  });

  it('leaves desired enabled after a failed connection and retries on enable', async () => {
    factory.start.mockRejectedValueOnce(new Error('invalid Discord token'));
    const service = makeService();
    settings = { enabled: true, tokenCiphertext: ciphertext };
    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    await flushStartup();
    await expect(service.status()).resolves.toMatchObject({
      desiredEnabled: true,
      connection: 'failed',
    });

    factory.start.mockResolvedValueOnce(makeContext());
    await service.setEnabled(true);
    await expect(service.status()).resolves.toMatchObject({ connection: 'connected' });
    expect(factory.start).toHaveBeenCalledTimes(2);
  });

  it('stops and reports a failed runtime after an async Discord client error', async () => {
    const context = makeContext();
    let reportClientError!: () => void;
    factory.start.mockImplementationOnce(
      (_token: string, _guildId: string | undefined, _signal: AbortSignal, onError: () => void) => {
        reportClientError = onError;
        return Promise.resolve(context);
      },
    );
    const service = makeService();
    await service.replaceToken(token);
    await service.setEnabled(true);

    reportClientError();
    await vi.waitFor(async () => {
      await expect(service.status()).resolves.toMatchObject({
        desiredEnabled: true,
        connection: 'failed',
        message: 'Discord bot encountered an error and was stopped',
      });
      expect(context.close).toHaveBeenCalledOnce();
    });
  });

  it('supports production configuration without a development guild ID', async () => {
    settings = { enabled: true, tokenCiphertext: ciphertext };
    const service = new BotRuntimeService(
      store as unknown as BotSettingsStore,
      cipher as unknown as BotTokenCipher,
      factory as unknown as BotContextFactory,
      new ConfigService({}, { skipProcessEnv: true }),
    );
    await service.onApplicationBootstrap();
    await flushStartup();

    expect(factory.start).toHaveBeenCalledWith(
      token,
      undefined,
      expect.any(AbortSignal),
      expect.any(Function),
    );
    await expect(service.status()).resolves.toMatchObject({ connection: 'connected' });
  });

  it('closes a running context during application shutdown', async () => {
    const context = makeContext();
    factory.start.mockResolvedValue(context);
    const service = makeService();
    await service.replaceToken(token);
    await service.setEnabled(true);

    await service.onApplicationShutdown();

    expect(context.close).toHaveBeenCalledOnce();
  });
});
