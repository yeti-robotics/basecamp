import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { NecordModule } from 'necord';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('AppModule', () => {
  const envKeys = [
    'DATABASE_URL',
    'BETTER_AUTH_SECRET',
    'BETTER_AUTH_URL',
    'DISCORD_CLIENT_ID',
    'DISCORD_CLIENT_SECRET',
    'DISCORD_TOKEN',
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
      DISCORD_CLIENT_ID: 'client-id',
      DISCORD_CLIENT_SECRET: 'client-secret',
      DISCORD_TOKEN: ' ',
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

  it('does not register the Discord bot when both optional settings are blank', async () => {
    const { AppModule } = await import('./app.module.js');
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) as unknown[];
    const registersNecord = imports.some(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        'module' in entry &&
        entry.module === NecordModule,
    );

    expect(registersNecord).toBe(false);
  });

  it('registers the Discord bot when both settings are configured', async () => {
    vi.resetModules();
    process.env.DISCORD_TOKEN = 'bot-token';
    process.env.DISCORD_DEVELOPMENT_GUILD_ID = 'guild-id';

    const { AppModule } = await import('./app.module.js');
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) as unknown[];
    const registersNecord = imports.some(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        'module' in entry &&
        entry.module === NecordModule,
    );

    expect(registersNecord).toBe(true);
  });

  it('loads validated configuration from the extracted options', async () => {
    vi.resetModules();
    process.env.DISCORD_TOKEN = ' ';
    process.env.DISCORD_DEVELOPMENT_GUILD_ID = ' ';

    const { AppModule } = await import('./app.module.js');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await module.init();

    expect(module.get(ConfigModule, { strict: false })).toBeDefined();

    await module.close();
  });
});
