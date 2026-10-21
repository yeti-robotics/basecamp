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
  ATTENDANCE_TOTP_SECRET: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
  ATTENDANCE_DISPLAY_PASSWORD: 'mentor-configured-password',
  ATTENDANCE_DISPLAY_SESSION_SECRET: 'a-display-session-secret-longer-than-32-chars',
  DISCORD_CLIENT_ID: 'client-id',
  DISCORD_CLIENT_SECRET: 'client-secret',
  DISCORD_GUILD_ID: '408711970305474560',
  BASECAMP_BOOTSTRAP_ADMIN_DISCORD_IDS: '123456789012345678, 234567890123456789',
  BASECAMP_TIME_ZONE: 'America/New_York',
};

describe('API environment schema', () => {
  it('defaults the port and coerces an explicitly configured port', () => {
    expect(envSchema.parse(valid).PORT).toBe(8000);
    expect(envSchema.parse({ ...valid, PORT: '3001' }).PORT).toBe(3001);
  });

  it('does not require an admission bot token', () => {
    expect(envSchema.safeParse(valid).success).toBe(true);
    expect(
      envSchema.safeParse({ ...valid, DISCORD_ADMISSION_BOT_TOKEN: 'obsolete-token' }).success,
    ).toBe(true);
  });

  it('allows bot-free startup without an encryption key and accepts a 32-byte key', () => {
    const key = Buffer.alloc(32, 1).toString('base64');
    expect(envSchema.parse(valid).BOT_SETTINGS_ENCRYPTION_KEY).toBeUndefined();
    expect(
      envSchema.parse({ ...valid, BOT_SETTINGS_ENCRYPTION_KEY: key }).BOT_SETTINGS_ENCRYPTION_KEY,
    ).toBe(key);
  });

  it('allows a development guild setting without configuring a Discord bot token', () => {
    expect(envSchema.safeParse(valid).success).toBe(true);
    expect(
      envSchema.safeParse({ ...valid, DISCORD_DEVELOPMENT_GUILD_ID: '123456789012345678' }).success,
    ).toBe(true);
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
    ['DISCORD_GUILD_ID', 'guild-id'],
    ['DISCORD_GUILD_ID', '12345678901234567x'],
    ['BOT_SETTINGS_ENCRYPTION_KEY', 'not-base64'],
    ['BOT_SETTINGS_ENCRYPTION_KEY', Buffer.alloc(16, 1).toString('base64')],
    ['BASECAMP_BOOTSTRAP_ADMIN_DISCORD_IDS', 'not-a-snowflake'],
    ['BASECAMP_TIME_ZONE', 'Mars/Olympus'],
    ['PORT', '0'],
    ['PORT', '65536'],
    ['PORT', '3.5'],
    ['PORT', 'abc'],
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
    'ATTENDANCE_TOTP_SECRET',
    'ATTENDANCE_DISPLAY_PASSWORD',
    'ATTENDANCE_DISPLAY_SESSION_SECRET',
    'DISCORD_CLIENT_ID',
    'DISCORD_CLIENT_SECRET',
    'DISCORD_GUILD_ID',
    'BOT_SETTINGS_ENCRYPTION_KEY',
    'BASECAMP_BOOTSTRAP_ADMIN_DISCORD_IDS',
    'BASECAMP_TIME_ZONE',
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
      ATTENDANCE_TOTP_SECRET: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
      ATTENDANCE_DISPLAY_PASSWORD: 'mentor-configured-password',
      ATTENDANCE_DISPLAY_SESSION_SECRET: 'a-display-session-secret-longer-than-32-chars',
      DISCORD_CLIENT_ID: 'client-id',
      DISCORD_CLIENT_SECRET: 'client-secret',
      DISCORD_GUILD_ID: '408711970305474560',
      BOT_SETTINGS_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
      BASECAMP_BOOTSTRAP_ADMIN_DISCORD_IDS: '123456789012345678',
      BASECAMP_TIME_ZONE: 'America/New_York',
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
