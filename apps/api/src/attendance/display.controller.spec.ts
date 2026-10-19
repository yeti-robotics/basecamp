import { ConfigModule, ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH } from '../auth/auth.module.js';
import { configureTrustedProxy } from '../configure-http.js';
import { DatabaseService } from '../database/database.service.js';
import { AttendanceModule } from './attendance.module.js';

const seed = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const password = 'mentor-configured-password';
const sessionSecret = 'a-display-session-secret-longer-than-32-chars';
const sessionLifetimeMs = 43_200_000;

describe('attendance display HTTP API', () => {
  let app: NestExpressApplication;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), AttendanceModule],
    })
      .overrideProvider(ConfigService)
      .useValue(
        new ConfigService({
          ATTENDANCE_TOTP_SECRET: seed,
          ATTENDANCE_DISPLAY_PASSWORD: password,
          ATTENDANCE_DISPLAY_SESSION_SECRET: sessionSecret,
        }),
      )
      .overrideProvider(AUTH)
      .useValue({ api: {} })
      .overrideProvider(DatabaseService)
      .useValue({ db: {} })
      .compile();
    app = module.createNestApplication<NestExpressApplication>();
    configureTrustedProxy(app, new ConfigService({ ATTENDANCE_TRUSTED_PROXY: 'loopback' }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it('protects the seed with a password and a signed, private display cookie', async () => {
    process.env.NODE_ENV = 'production';
    await request(app.getHttpServer()).get('/api/attendance-display/seed').expect(401);
    const wrong = await request(app.getHttpServer())
      .post('/api/attendance-display/login')
      .send({ password: 'wrong' })
      .expect(401);
    expect(wrong.headers['set-cookie']).toBeUndefined();

    const login = await request(app.getHttpServer())
      .post('/api/attendance-display/login')
      .send({ password })
      .expect(204);
    const cookie = (login.headers['set-cookie'] as string[])[0];
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Secure');

    const response = await request(app.getHttpServer())
      .get('/api/attendance-display/seed')
      .set('Cookie', cookie)
      .expect(200);
    expect(response.body).toEqual({ secret: seed, expiresAt: expect.any(Number) });
    expect(response.headers['cache-control']).toBe('no-store');

    await request(app.getHttpServer())
      .get('/api/attendance-display/seed')
      .set('Cookie', `${cookie.split(';')[0]}x`)
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/attendance-display/seed')
      .set('Cookie', `${cookie.split(';')[0]}; ${cookie.split(';')[0]}`)
      .expect(401);

    const logout = await request(app.getHttpServer())
      .post('/api/attendance-display/logout')
      .set('Cookie', cookie)
      .expect(204);
    expect((logout.headers['set-cookie'] as string[])[0]).toMatch(/^attendance_display=;/);
    await request(app.getHttpServer())
      .get('/api/attendance-display/seed')
      .set('Cookie', (logout.headers['set-cookie'] as string[])[0])
      .expect(401);
  });

  it('expires an open display session after 12 hours', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const login = await request(app.getHttpServer())
      .post('/api/attendance-display/login')
      .send({ password })
      .expect(204);
    const cookie = (login.headers['set-cookie'] as string[])[0];

    now.mockReturnValue(1_000_000 + sessionLifetimeMs);
    await request(app.getHttpServer())
      .get('/api/attendance-display/seed')
      .set('Cookie', cookie)
      .expect(401);
  });

  it('limits password attempts from one source address', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      await request(app.getHttpServer())
        .post('/api/attendance-display/login')
        .send({ password: 'wrong' })
        .expect(401);
    }
    await request(app.getHttpServer())
      .post('/api/attendance-display/login')
      .send({ password })
      .expect(429);
  });

  it('limits each client address independently when the dashboard proxy is trusted', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      await request(app.getHttpServer())
        .post('/api/attendance-display/login')
        .set('X-Forwarded-For', '192.0.2.10')
        .send({ password: 'wrong' })
        .expect(401);
    }
    await request(app.getHttpServer())
      .post('/api/attendance-display/login')
      .set('X-Forwarded-For', '192.0.2.11')
      .send({ password })
      .expect(204);
    await request(app.getHttpServer())
      .post('/api/attendance-display/login')
      .set('X-Forwarded-For', '192.0.2.10')
      .send({ password })
      .expect(429);
  });

  it('ignores forged forwarding headers from an untrusted direct client', async () => {
    configureTrustedProxy(app, new ConfigService({ ATTENDANCE_TRUSTED_PROXY: '10.0.0.0/8' }));
    for (let attempt = 0; attempt < 5; attempt++) {
      await request(app.getHttpServer())
        .post('/api/attendance-display/login')
        .set('X-Forwarded-For', `192.0.2.${attempt + 1}`)
        .send({ password: 'wrong' })
        .expect(401);
    }
    await request(app.getHttpServer())
      .post('/api/attendance-display/login')
      .set('X-Forwarded-For', '192.0.2.99')
      .send({ password })
      .expect(429);
  });
});
