import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
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

  beforeEach(async () => {
    previousEnv = new Map(envKeys.map((key) => [key, process.env[key]]));
    process.env.DISCORD_TOKEN = '';
    process.env.DISCORD_DEVELOPMENT_GUILD_ID = '';
    process.env.PORT = '8000';
    Object.assign(process.env, {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/basecamp-test',
      BETTER_AUTH_SECRET: 'test-secret-at-least-thirty-two-characters',
      BETTER_AUTH_URL: 'http://localhost:3000',
      DISCORD_CLIENT_ID: 'test-client-id',
      DISCORD_CLIENT_SECRET: 'test-client-secret',
    });
    const { AppModule } = await import('../src/app.module.js');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue(
        new ConfigService({
          DATABASE_URL: 'postgresql://test:test@localhost:5432/basecamp-test',
          BETTER_AUTH_SECRET: 'test-secret-at-least-thirty-two-characters',
          BETTER_AUTH_URL: 'http://localhost:3000',
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
