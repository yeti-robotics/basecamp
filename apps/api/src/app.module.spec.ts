import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BotContextFactory } from './bot/bot-context.factory.js';
import { BotRuntimeService } from './bot/bot-runtime.service.js';
import { BotSettingsStore } from './bot/bot-settings.store.js';
import { BotTokenCipher } from './bot/bot-token-cipher.js';

describe('AppModule', () => {
  const envKeys = [
    'DATABASE_URL',
    'BETTER_AUTH_SECRET',
    'BETTER_AUTH_URL',
    'ATTENDANCE_TOTP_SECRET',
    'ATTENDANCE_DISPLAY_PASSWORD',
    'ATTENDANCE_DISPLAY_SESSION_SECRET',
    'DISCORD_CLIENT_ID',
    'DISCORD_CLIENT_SECRET',
    'DISCORD_GUILD_ID',
    'BASECAMP_BOOTSTRAP_ADMIN_DISCORD_IDS',
    'BASECAMP_TIME_ZONE',
    'DISCORD_DEVELOPMENT_GUILD_ID',
    'PORT',
  ];
  let previousEnv = new Map<string, string | undefined>();

  beforeEach(() => {
    previousEnv = new Map(envKeys.map((key) => [key, process.env[key]]));
    Object.assign(process.env, {
      DATABASE_URL: 'postgresql://test:test@localhost/basecamp-test',
      BETTER_AUTH_SECRET: 'test-secret-at-least-thirty-two-characters',
      BETTER_AUTH_URL: 'http://localhost:3000',
      ATTENDANCE_TOTP_SECRET: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
      ATTENDANCE_DISPLAY_PASSWORD: 'mentor-configured-password',
      ATTENDANCE_DISPLAY_SESSION_SECRET: 'a-display-session-secret-longer-than-32-chars',
      DISCORD_CLIENT_ID: 'client-id',
      DISCORD_CLIENT_SECRET: 'client-secret',
      DISCORD_GUILD_ID: '408711970305474560',
      BASECAMP_BOOTSTRAP_ADMIN_DISCORD_IDS: '123456789012345678',
      BASECAMP_TIME_ZONE: 'America/New_York',
      DISCORD_DEVELOPMENT_GUILD_ID: ' ',
      PORT: '8000',
    });
  });

  afterEach(() => {
    for (const key of envKeys) {
      const value = previousEnv.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('does not import a Discord client into the HTTP application', async () => {
    const { AppModule } = await import('./app.module.js');
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) as unknown[];
    expect(
      imports.some((entry) => typeof entry === 'function' && entry.name === 'NecordModule'),
    ).toBe(false);
  });

  it('loads validated configuration from the extracted options', async () => {
    process.env.DISCORD_DEVELOPMENT_GUILD_ID = ' ';

    const { AppModule } = await import('./app.module.js');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(BotSettingsStore)
      .useValue({ load: vi.fn().mockResolvedValue({ enabled: false, tokenCiphertext: null }) })
      .compile();
    await module.init();

    expect(module.get(ConfigModule, { strict: false })).toBeDefined();

    await module.close();
  });

  it('serves health when a saved bot token fails during startup', async () => {
    const { AppModule } = await import('./app.module.js');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(BotSettingsStore)
      .useValue({
        load: vi.fn().mockResolvedValue({ enabled: true, tokenCiphertext: 'ciphertext' }),
      })
      .overrideProvider(BotTokenCipher)
      .useValue({ decrypt: vi.fn(() => 'invalid-token') })
      .overrideProvider(BotContextFactory)
      .useValue({ start: vi.fn().mockRejectedValue(new Error('bad Discord token')) })
      .compile();
    const app = module.createNestApplication();
    await app.init();
    await new Promise<void>((resolve) => setImmediate(resolve));

    await request(app.getHttpServer()).get('/health').expect(200, { status: 'ok' });
    await expect(app.get(BotRuntimeService).status()).resolves.toMatchObject({
      desiredEnabled: true,
      connection: 'failed',
    });

    await app.close();
  });
});
