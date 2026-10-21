import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessService } from '../src/access/access.service.js';
import { AUTH } from '../src/auth/auth.module.js';
import { BotRuntimeService } from '../src/bot/bot-runtime.service.js';
import { BotSettingsStore } from '../src/bot/bot-settings.store.js';
import { SeasonAuthorizationService } from '../src/seasons/season-authorization.service.js';

describe('Bot settings API (e2e)', () => {
  let app: INestApplication;
  let session: { user: { id: string; role?: string } } | null;
  let suspended: boolean;
  let canManage: boolean;
  let runtimeStatus: Record<string, unknown>;
  const setEnabled = vi.fn();
  const replaceToken = vi.fn();
  const setStatusMessage = vi.fn();
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

  beforeEach(async () => {
    previousEnv = new Map(envKeys.map((key) => [key, process.env[key]]));
    Object.assign(process.env, {
      DATABASE_URL: 'postgresql://test:test@localhost/basecamp-test',
      BETTER_AUTH_SECRET: 'test-secret-at-least-thirty-two-characters',
      BETTER_AUTH_URL: 'http://localhost:3000',
      ATTENDANCE_TOTP_SECRET: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
      ATTENDANCE_DISPLAY_PASSWORD: 'mentor-configured-password',
      ATTENDANCE_DISPLAY_SESSION_SECRET: 'a-display-session-secret-longer-than-32-chars',
      DISCORD_CLIENT_ID: 'test-client-id',
      DISCORD_CLIENT_SECRET: 'test-client-secret',
      DISCORD_GUILD_ID: '408711970305474560',
      BASECAMP_BOOTSTRAP_ADMIN_DISCORD_IDS: '123456789012345678',
      BASECAMP_TIME_ZONE: 'America/New_York',
      DISCORD_DEVELOPMENT_GUILD_ID: '',
      PORT: '8000',
    });
    session = { user: { id: 'admin-1' } };
    suspended = false;
    canManage = true;
    runtimeStatus = { desiredEnabled: false, tokenConfigured: false, connection: 'off' };
    setEnabled.mockImplementation(async (enabled: boolean) => {
      runtimeStatus = {
        desiredEnabled: enabled,
        tokenConfigured: true,
        connection: enabled ? 'connected' : 'off',
      };
      return runtimeStatus;
    });
    replaceToken.mockImplementation(async () => {
      runtimeStatus = { ...runtimeStatus, tokenConfigured: true };
      return runtimeStatus;
    });

    const { AppModule } = await import('../src/app.module.js');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AUTH)
      .useValue({ api: { getSession: vi.fn(async () => session) } })
      .overrideProvider(AccessService)
      .useValue({ isSuspended: vi.fn(async () => suspended) })
      .overrideProvider(SeasonAuthorizationService)
      .useValue({ accessFor: vi.fn(async () => ({ canManage })) })
      .overrideProvider(BotRuntimeService)
      .useValue({
        status: vi.fn(async () => runtimeStatus),
        setEnabled,
        replaceToken,
        setStatusMessage,
      })
      .overrideProvider(BotSettingsStore)
      .useValue({ load: async () => ({ enabled: false, tokenCiphertext: null }) })
      .overrideProvider(ConfigService)
      .useValue(
        new ConfigService({
          DATABASE_URL: 'postgresql://test:test@localhost/basecamp-test',
          BETTER_AUTH_SECRET: 'test-secret-at-least-thirty-two-characters',
          BETTER_AUTH_URL: 'http://localhost:3000',
          ATTENDANCE_TOTP_SECRET: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
          ATTENDANCE_DISPLAY_PASSWORD: 'mentor-configured-password',
          ATTENDANCE_DISPLAY_SESSION_SECRET: 'a-display-session-secret-longer-than-32-chars',
          DISCORD_CLIENT_ID: 'test-client-id',
          DISCORD_CLIENT_SECRET: 'test-client-secret',
          DISCORD_GUILD_ID: '408711970305474560',
          BASECAMP_TIME_ZONE: 'America/New_York',
        }),
      )
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
    for (const key of envKeys) {
      const value = previousEnv.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('requires an authenticated, unsuspended Team Admin for status and writes', async () => {
    session = null;
    await request(app.getHttpServer()).get('/api/settings/bot').expect(401);
    session = { user: { id: 'admin-1' } };
    suspended = true;
    await request(app.getHttpServer()).get('/api/settings/bot').expect(401);
    suspended = false;
    canManage = false;
    await request(app.getHttpServer()).get('/api/settings/bot').expect(403);
    await request(app.getHttpServer())
      .put('/api/settings/bot/enabled')
      .send({ enabled: true })
      .expect(403);
  });

  it('does not treat a Better Auth global admin role as Team Admin access', async () => {
    session = { user: { id: 'student-1', role: 'admin' } };
    canManage = false;
    await request(app.getHttpServer()).get('/api/settings/bot').expect(403);
  });

  it('validates request DTOs and forbids extra fields', async () => {
    await request(app.getHttpServer()).put('/api/settings/bot/token').send({}).expect(400);
    await request(app.getHttpServer())
      .put('/api/settings/bot/token')
      .send({ token: 'x', extra: 1 })
      .expect(400);
    await request(app.getHttpServer())
      .put('/api/settings/bot/enabled')
      .send({ enabled: 'yes' })
      .expect(400);
    await request(app.getHttpServer())
      .put('/api/settings/bot/enabled')
      .send({ enabled: true, token: 'x' })
      .expect(400);
  });

  it('returns safe status with no-store headers and supports idempotent state changes', async () => {
    const get = () => request(app.getHttpServer()).get('/api/settings/bot').expect(200);
    const response = await get();
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.body).toEqual(runtimeStatus);
    for (const enabled of [true, true, false, false]) {
      const update = await request(app.getHttpServer())
        .put('/api/settings/bot/enabled')
        .send({ enabled })
        .expect(200);
      expect(update.headers['cache-control']).toBe('private, no-store');
      expect(update.body).not.toHaveProperty('token');
      expect(update.body).not.toHaveProperty('tokenCiphertext');
    }
    expect(setEnabled).toHaveBeenCalledTimes(4);
  });

  it('accepts a token write but never returns the token or ciphertext', async () => {
    const response = await request(app.getHttpServer())
      .put('/api/settings/bot/token')
      .send({ token: 'plain-secret-token' })
      .expect(200);
    expect(replaceToken).toHaveBeenCalledWith('plain-secret-token');
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(JSON.stringify(response.body)).not.toContain('plain-secret-token');
    expect(response.body).not.toHaveProperty('tokenCiphertext');
  });

  it('saves a status message and rejects a blank or oversized one', async () => {
    setStatusMessage.mockImplementation(async (statusMessage: string) => {
      runtimeStatus = { ...runtimeStatus, statusMessage };
      return runtimeStatus;
    });

    const saved = await request(app.getHttpServer())
      .put('/api/settings/bot/status-message')
      .send({ statusMessage: 'Scrimmage tonight' })
      .expect(200);
    expect(saved.headers['cache-control']).toBe('private, no-store');
    expect(setStatusMessage).toHaveBeenCalledWith('Scrimmage tonight');
    expect(saved.body).toMatchObject({ statusMessage: 'Scrimmage tonight' });

    await request(app.getHttpServer())
      .put('/api/settings/bot/status-message')
      .send({ statusMessage: '   ' })
      .expect(400);
    await request(app.getHttpServer())
      .put('/api/settings/bot/status-message')
      .send({ statusMessage: 'x'.repeat(129) })
      .expect(400);
    await request(app.getHttpServer())
      .put('/api/settings/bot/status-message')
      .send({ statusMessage: 'Scrimmage tonight', extra: true })
      .expect(400);
  });
});
