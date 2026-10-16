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

import { AccessService } from '../access/access.service.js';
import { DatabaseService } from '../database/database.service.js';
import * as authSchema from '../database/schema/auth.js';
import { AUTH, AuthModule, DISCORD_ADMISSION } from './auth.module.js';

const validSettings = {
  BETTER_AUTH_SECRET: 'test-secret-at-least-thirty-two-characters',
  BETTER_AUTH_URL: 'http://localhost:3000',
  DISCORD_CLIENT_ID: 'test-client-id',
  DISCORD_CLIENT_SECRET: 'test-client-secret',
  DISCORD_GUILD_ID: '408711970305474560',
  DISCORD_ADMISSION_BOT_TOKEN: 'test-admission-token',
};
const admission = { verify: vi.fn() };
const access = { isDiscordIdentitySuspended: vi.fn() };

describe('AuthModule', () => {
  const database = { db: { testDatabase: true } };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.admin.mockReturnValue({ kind: 'admin-plugin' });
    mocks.drizzleAdapter.mockReturnValue({ kind: 'drizzle-adapter' });
    mocks.betterAuth.mockReturnValue({ kind: 'auth-instance' });
    admission.verify.mockResolvedValue('allowed');
    access.isDiscordIdentitySuspended.mockResolvedValue(false);
  });

  async function makeModule(settings: Record<string, string>) {
    return Test.createTestingModule({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true }), AuthModule],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService(settings))
      .overrideProvider(DatabaseService)
      .useValue(database)
      .overrideProvider(DISCORD_ADMISSION)
      .useValue(admission)
      .overrideProvider(AccessService)
      .useValue(access)
      .compile();
  }

  it('builds Better Auth with the injected Drizzle client and auth schema', async () => {
    const module = await makeModule(validSettings);
    expect(module.get(AUTH)).toEqual({ kind: 'auth-instance' });
    expect(mocks.drizzleAdapter).toHaveBeenCalledWith(database.db, {
      provider: 'pg',
      schema: authSchema,
    });
    expect(mocks.betterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: validSettings.BETTER_AUTH_URL,
        secret: validSettings.BETTER_AUTH_SECRET,
        database: { kind: 'drizzle-adapter' },
        emailAndPassword: { enabled: false },
        socialProviders: {
          discord: {
            clientId: validSettings.DISCORD_CLIENT_ID,
            clientSecret: validSettings.DISCORD_CLIENT_SECRET,
            mapProfileToUser: expect.any(Function),
          },
        },
        user: { validateUserInfo: expect.any(Function) },
        plugins: [{ kind: 'admin-plugin' }],
      }),
    );
    const options = mocks.betterAuth.mock.calls[0][0];
    const validateUserInfo = options.user.validateUserInfo;
    await expect(
      validateUserInfo(
        {
          user: {},
          source: {
            method: 'oauth',
            action: 'create-user',
            oauth: { providerId: 'discord', profile: { id: '123456789012345678' } },
          },
        },
        {},
      ),
    ).resolves.toBeUndefined();
    expect(admission.verify).toHaveBeenCalledWith('123456789012345678');
    await module.close();
  });

  it.each(['create-user', 'sign-in', 'link-account'] as const)(
    'rejects a nonmember before Better Auth can %s',
    async (action) => {
      admission.verify.mockResolvedValue('denied');
      const module = await makeModule(validSettings);
      const validateUserInfo = mocks.betterAuth.mock.calls[0][0].user.validateUserInfo;
      await expect(
        validateUserInfo(
          {
            user: {},
            source: {
              method: 'oauth',
              action,
              oauth: { providerId: 'discord', profile: { id: '123456789012345678' } },
            },
          },
          {},
        ),
      ).resolves.toMatchObject({ error: expect.any(String) });
      await module.close();
    },
  );

  it('rejects Discord admission outages and malformed profiles without falling back to email', async () => {
    admission.verify.mockResolvedValue('unavailable');
    const module = await makeModule(validSettings);
    const validateUserInfo = mocks.betterAuth.mock.calls[0][0].user.validateUserInfo;
    const source = {
      method: 'oauth',
      action: 'sign-in',
      oauth: {
        providerId: 'discord',
        profile: { id: '123456789012345678', email: 'member@example.org' },
      },
    };
    await expect(validateUserInfo({ user: {}, source }, {})).resolves.toMatchObject({
      error: expect.any(String),
    });
    await expect(
      validateUserInfo(
        {
          user: { email: 'member@example.org' },
          source: { ...source, oauth: { providerId: 'discord', profile: {} } },
        },
        {},
      ),
    ).resolves.toMatchObject({ error: expect.any(String) });
    expect(admission.verify).toHaveBeenCalledTimes(1);
    await module.close();
  });

  it('rejects sign-in for a suspended local account even when Discord membership is valid', async () => {
    access.isDiscordIdentitySuspended.mockResolvedValue(true);
    const module = await makeModule(validSettings);
    const validateUserInfo = mocks.betterAuth.mock.calls[0][0].user.validateUserInfo;
    await expect(
      validateUserInfo(
        {
          user: {},
          source: {
            method: 'oauth',
            action: 'sign-in',
            oauth: { providerId: 'discord', profile: { id: '123456789012345678' } },
          },
        },
        {},
      ),
    ).resolves.toMatchObject({ error: 'basecamp_account_suspended' });
    await module.close();
  });

  it('does not use Discord admission for other identity providers', async () => {
    const module = await makeModule(validSettings);
    const validateUserInfo = mocks.betterAuth.mock.calls[0][0].user.validateUserInfo;
    await expect(
      validateUserInfo(
        {
          user: {},
          source: { method: 'oauth', action: 'create-user', oauth: { providerId: 'google' } },
        },
        {},
      ),
    ).resolves.toBeUndefined();
    expect(admission.verify).not.toHaveBeenCalled();
    await module.close();
  });

  it('maps email-less Discord users to an identifier-derived placeholder', async () => {
    const module = await makeModule(validSettings);
    const mapProfileToUser =
      mocks.betterAuth.mock.calls[0][0].socialProviders.discord.mapProfileToUser;
    expect(
      mapProfileToUser({ id: '123456789012345678', email: null, verified: false }),
    ).toMatchObject({
      email: 'discord-123456789012345678@users.invalid',
      emailVerified: false,
    });
    await module.close();
  });

  it.each([
    ['BETTER_AUTH_SECRET', ''],
    ['DISCORD_CLIENT_ID', ''],
    ['DISCORD_CLIENT_SECRET', ''],
    ['BETTER_AUTH_URL', ''],
  ])('requires %s', async (key, value) => {
    const settings = { ...validSettings, [key]: value };
    await expect(makeModule(settings)).rejects.toThrow(`${key} is required`);
    expect(mocks.betterAuth).not.toHaveBeenCalled();
  });

  it.each([['BETTER_AUTH_URL', 'ftp://auth.example.test']])(
    'rejects invalid %s without exposing its value',
    async (key, value) => {
      const settings = { ...validSettings, [key]: value };
      const error = await makeModule(settings).then(
        () => undefined,
        (cause: Error) => cause,
      );
      expect(error?.message).toBe(`${key} must be an HTTP(S) URL`);
      expect(error?.message).not.toContain(value);
      expect(mocks.betterAuth).not.toHaveBeenCalled();
    },
  );

  it('rejects short auth secrets without passing them to Better Auth', async () => {
    const secret = 'too-short-secret';
    await expect(makeModule({ ...validSettings, BETTER_AUTH_SECRET: secret })).rejects.toThrow(
      'BETTER_AUTH_SECRET must contain at least 32 characters',
    );
    expect(mocks.betterAuth).not.toHaveBeenCalled();
  });
});
