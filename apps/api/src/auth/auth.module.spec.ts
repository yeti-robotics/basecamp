import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  betterAuth: vi.fn(),
  drizzleAdapter: vi.fn(),
}));

vi.mock('better-auth', () => ({ betterAuth: mocks.betterAuth }));
vi.mock('better-auth/plugins', () => ({ admin: mocks.admin }));
vi.mock('@better-auth/drizzle-adapter', () => ({ drizzleAdapter: mocks.drizzleAdapter }));

import { DatabaseService } from '../database/database.service.js';
import * as authSchema from '../database/schema/auth.js';
import { AUTH, AuthModule } from './auth.module.js';

const validSettings = {
  BETTER_AUTH_SECRET: 'test-secret-at-least-thirty-two-characters',
  BETTER_AUTH_URL: 'http://localhost:3000',
  DASHBOARD_URL: 'http://localhost:3000',
  DISCORD_CLIENT_ID: 'test-client-id',
  DISCORD_CLIENT_SECRET: 'test-client-secret',
};

describe('AuthModule', () => {
  const database = { db: { testDatabase: true } };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.admin.mockReturnValue({ kind: 'admin-plugin' });
    mocks.drizzleAdapter.mockReturnValue({ kind: 'drizzle-adapter' });
    mocks.betterAuth.mockReturnValue({ kind: 'auth-instance' });
  });

  async function makeModule(settings: Record<string, string>) {
    return Test.createTestingModule({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true }), AuthModule],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService(settings))
      .overrideProvider(DatabaseService)
      .useValue(database)
      .compile();
  }

  it('builds Better Auth with the injected Drizzle client and auth schema', async () => {
    const module = await makeModule(validSettings);
    expect(module.get(AUTH)).toEqual({ kind: 'auth-instance' });
    expect(mocks.drizzleAdapter).toHaveBeenCalledWith(database.db, {
      provider: 'pg',
      schema: authSchema,
    });
    expect(mocks.betterAuth).toHaveBeenCalledWith(expect.objectContaining({
      baseURL: validSettings.BETTER_AUTH_URL,
      trustedOrigins: ['http://localhost:3000'],
      secret: validSettings.BETTER_AUTH_SECRET,
      database: { kind: 'drizzle-adapter' },
      emailAndPassword: { enabled: false },
      socialProviders: {
        discord: {
          clientId: validSettings.DISCORD_CLIENT_ID,
          clientSecret: validSettings.DISCORD_CLIENT_SECRET,
        },
      },
      plugins: [{ kind: 'admin-plugin' }],
    }));
    await module.close();
  });

  it.each([
    ['BETTER_AUTH_SECRET', ''],
    ['DISCORD_CLIENT_ID', ''],
    ['DISCORD_CLIENT_SECRET', ''],
    ['BETTER_AUTH_URL', ''],
    ['DASHBOARD_URL', ''],
  ])('requires %s', async (key, value) => {
    const settings = { ...validSettings, [key]: value };
    await expect(makeModule(settings)).rejects.toThrow(`${key} is required`);
    expect(mocks.betterAuth).not.toHaveBeenCalled();
  });

  it.each([
    ['BETTER_AUTH_URL', 'ftp://auth.example.test'],
    ['DASHBOARD_URL', 'not a url'],
  ])('rejects invalid %s without exposing its value', async (key, value) => {
    const settings = { ...validSettings, [key]: value };
    const error = await makeModule(settings).then(() => undefined, (cause: Error) => cause);
    expect(error?.message).toBe(`${key} must be an HTTP(S) URL`);
    expect(error?.message).not.toContain(value);
    expect(mocks.betterAuth).not.toHaveBeenCalled();
  });

  it('rejects short auth secrets without passing them to Better Auth', async () => {
    const secret = 'too-short-secret';
    await expect(makeModule({ ...validSettings, BETTER_AUTH_SECRET: secret }))
      .rejects.toThrow('BETTER_AUTH_SECRET must contain at least 32 characters');
    expect(mocks.betterAuth).not.toHaveBeenCalled();
  });
});
