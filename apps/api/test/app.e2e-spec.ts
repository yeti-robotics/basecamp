import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { BotSettingsStore } from '../src/bot/bot-settings.store.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
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
    'BASECAMP_TIME_ZONE',
    'DISCORD_DEVELOPMENT_GUILD_ID',
    'PORT',
  ];
  let previousEnv = new Map<string, string | undefined>();

  beforeEach(async () => {
    previousEnv = new Map(envKeys.map((key) => [key, process.env[key]]));
    process.env.DISCORD_DEVELOPMENT_GUILD_ID = '';
    process.env.PORT = '8000';
    Object.assign(process.env, {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/basecamp-test',
      BETTER_AUTH_SECRET: 'test-secret-at-least-thirty-two-characters',
      BETTER_AUTH_URL: 'http://localhost:3000',
      ATTENDANCE_TOTP_SECRET: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
      ATTENDANCE_DISPLAY_PASSWORD: 'mentor-configured-password',
      ATTENDANCE_DISPLAY_SESSION_SECRET: 'a-display-session-secret-longer-than-32-chars',
      DISCORD_CLIENT_ID: 'test-client-id',
      DISCORD_CLIENT_SECRET: 'test-client-secret',
      DISCORD_GUILD_ID: '408711970305474560',
      BASECAMP_TIME_ZONE: 'America/New_York',
    });
    const { AppModule } = await import('../src/app.module.js');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(BotSettingsStore)
      .useValue({ load: async () => ({ enabled: false, tokenCiphertext: null }) })
      .overrideProvider(ConfigService)
      .useValue(
        new ConfigService({
          DATABASE_URL: 'postgresql://test:test@localhost:5432/basecamp-test',
          BETTER_AUTH_SECRET: 'test-secret-at-least-thirty-two-characters',
          BETTER_AUTH_URL: 'http://localhost:3000',
          ATTENDANCE_TOTP_SECRET: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
          ATTENDANCE_DISPLAY_PASSWORD: 'mentor-configured-password',
          ATTENDANCE_DISPLAY_SESSION_SECRET: 'a-display-session-secret-longer-than-32-chars',
          DISCORD_CLIENT_ID: 'test-client-id',
          DISCORD_CLIENT_SECRET: 'test-client-secret',
        }),
      )
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer()).get('/').expect(200).expect('Hello World!');
  });

  afterEach(async () => {
    await app?.close();
    for (const key of envKeys) {
      const value = previousEnv.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
});
