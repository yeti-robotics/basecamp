import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configOptions } from './config.options.js';
import { envSchema } from './env.validation.js';

const valid = {
  DATABASE_URL: 'postgresql://user:password@localhost/basecamp',
  BETTER_AUTH_SECRET: 'test-secret-at-least-thirty-two-characters',
  BETTER_AUTH_URL: 'http://localhost:3000',
  DISCORD_CLIENT_ID: 'client-id',
  DISCORD_CLIENT_SECRET: 'client-secret',
};

describe('API environment schema', () => {
  it('defaults the port and coerces an explicitly configured port', () => {
    expect(envSchema.parse(valid).PORT).toBe(8000);
    expect(envSchema.parse({ ...valid, PORT: '3001' }).PORT).toBe(3001);
  });

  it('accepts Discord bot configuration when both settings are present or absent', () => {
    expect(envSchema.safeParse(valid).success).toBe(true);
    expect(
      envSchema.safeParse({
        ...valid,
        DISCORD_TOKEN: 'bot-token',
        DISCORD_DEVELOPMENT_GUILD_ID: 'guild-id',
      }).success,
    ).toBe(true);
    expect(
      envSchema.safeParse({
        ...valid,
        DISCORD_TOKEN: '',
        DISCORD_DEVELOPMENT_GUILD_ID: '',
      }).success,
    ).toBe(true);
    expect(
      envSchema.safeParse({ ...valid, DISCORD_TOKEN: '', DISCORD_DEVELOPMENT_GUILD_ID: 'guild-id' })
        .success,
    ).toBe(false);
  });

  it.each([
    ['DATABASE_URL', ''],
    ['DATABASE_URL', 'https://user:secret@example.test/db'],
    ['DATABASE_URL', 'postgres:database'],
    ['BETTER_AUTH_SECRET', 'short'],
    ['BETTER_AUTH_SECRET', '                                '],
    ['BETTER_AUTH_URL', ''],
    ['BETTER_AUTH_URL', 'ftp://auth.example.test'],
    ['DISCORD_CLIENT_ID', ' '],
    ['DISCORD_CLIENT_SECRET', ''],
    ['PORT', '0'],
    ['PORT', '65536'],
    ['PORT', '3.5'],
    ['PORT', 'abc'],
    ['DISCORD_TOKEN', 'bot-token'],
    ['DISCORD_DEVELOPMENT_GUILD_ID', 'guild-id'],
  ])('rejects invalid %s configuration', (key, value) => {
    const result = envSchema.safeParse({ ...valid, [key]: value });
    expect(result.success).toBe(false);
    if (!result.success && key === 'DATABASE_URL') {
      expect(result.error.message).toContain('DATABASE_URL');
      expect(result.error.message).not.toContain('secret');
    }
  });
});

describe('ConfigModule environment validation', () => {
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
  const previousEnv = new Map(envKeys.map((key) => [key, process.env[key]]));
  const modules: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>[] = [];
  let tempDirectory: string | undefined;

  beforeEach(() => {
    Object.assign(process.env, {
      DATABASE_URL: 'postgresql://user:password@localhost/basecamp',
      BETTER_AUTH_SECRET: 'test-secret-at-least-thirty-two-characters',
      BETTER_AUTH_URL: 'http://localhost:3000',
      DISCORD_CLIENT_ID: 'client-id',
      DISCORD_CLIENT_SECRET: 'client-secret',
    });
  });

  afterEach(async () => {
    await Promise.all(modules.splice(0).map((module) => module.close()));
    for (const key of envKeys) {
      const value = previousEnv.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (tempDirectory) rmSync(tempDirectory, { recursive: true, force: true });
    tempDirectory = undefined;
  });

  it('exposes coerced schema values through ConfigService', async () => {
    process.env.PORT = '3001';
    const configModule = await ConfigModule.forRoot({ ...configOptions, ignoreEnvFile: true });
    const module = await Test.createTestingModule({ imports: [configModule] }).compile();
    modules.push(module);

    expect(module.get(ConfigService).get<number>('PORT')).toBe(3001);
  });

  it('keeps predefined environment values ahead of env file values', async () => {
    tempDirectory = mkdtempSync(join(tmpdir(), 'basecamp-config-'));
    const envFile = join(tempDirectory, '.env');
    writeFileSync(envFile, 'PORT=3002\n');
    process.env.PORT = '3001';
    const configModule = await ConfigModule.forRoot({ ...configOptions, envFilePath: [envFile] });
    const module = await Test.createTestingModule({ imports: [configModule] }).compile();
    modules.push(module);

    expect(module.get(ConfigService).get<number>('PORT')).toBe(3001);
  });

  it('rejects an invalid port before ConfigService is available', async () => {
    process.env.PORT = 'abc';
    await expect(ConfigModule.forRoot({ ...configOptions, ignoreEnvFile: true })).rejects.toThrow(
      'PORT',
    );
  });
});
