import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscordAdmissionService } from '../src/auth/discord-admission.service.js';
import type { Auth } from '../src/auth.js';
import { createAuth } from '../src/auth.js';
import { configureHttp } from '../src/configure-http.js';
import type { AppDatabase } from '../src/database/database.service.js';

vi.mock('@better-auth/drizzle-adapter', () => ({
  drizzleAdapter: () => undefined,
}));

@Module({})
class AuthE2eModule {}

const settings = {
  BETTER_AUTH_SECRET: 'test-secret-at-least-thirty-two-characters',
  BETTER_AUTH_URL: 'http://localhost:8000',
  DISCORD_CLIENT_ID: 'test-client-id',
  DISCORD_CLIENT_SECRET: 'test-client-secret',
  DISCORD_GUILD_ID: '408711970305474560',
};
const discordProfile = {
  id: '123456789012345678',
  username: 'discord-user',
  global_name: 'Discord User',
  discriminator: '0',
  avatar: null,
  email: 'member@example.org',
  verified: true,
};

describe('Discord OAuth admission callback', () => {
  let app: NestExpressApplication;
  let fetcher: ReturnType<typeof vi.fn>;
  let auth: Auth;

  beforeEach(async () => {
    fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === 'https://discord.com/api/oauth2/token') {
        return new Response(
          JSON.stringify({
            access_token: 'oauth-user-token',
            token_type: 'Bearer',
            expires_in: 3600,
            refresh_token: 'oauth-refresh-token',
            scope: 'identify email guilds.members.read',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url === 'https://discord.com/api/users/@me') {
        return new Response(JSON.stringify(discordProfile), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url === 'https://discord.com/api/v10/users/@me/guilds/408711970305474560/member') {
        return new Response(null, { status: 404 });
      }
      return new Response(null, { status: 500 });
    });
    vi.stubGlobal('fetch', fetcher);

    const config = new ConfigService(settings);
    const admission = new DiscordAdmissionService(config, fetcher);
    auth = createAuth({} as AppDatabase, config, admission, {
      isDiscordIdentitySuspended: async () => false,
    });
    app = await NestFactory.create<NestExpressApplication>(AuthE2eModule, {
      bodyParser: false,
      logger: false,
    });
    configureHttp(app, auth);
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
    vi.unstubAllGlobals();
  });

  it('does not provision a user or session for a nonmember OAuth callback', async () => {
    const start = await request(app.getHttpServer())
      .post('/api/auth/sign-in/social')
      .send({ provider: 'discord', callbackURL: 'http://localhost:3000/' })
      .expect(200);
    const authorizationUrl = new URL(start.body.url as string);
    const scopes = authorizationUrl.searchParams.get('scope')?.split(' ') ?? [];
    expect(scopes).toContain('guilds.members.read');
    expect(scopes).not.toContain('bot');

    const state = authorizationUrl.searchParams.get('state');
    expect(state).toBeTruthy();
    const cookies = (start.headers['set-cookie'] ?? [])
      .map((cookie: string) => cookie.split(';')[0])
      .join('; ');
    const callback = await request(app.getHttpServer())
      .get(`/api/auth/callback/discord?code=authorization-code&state=${encodeURIComponent(state!)}`)
      .set('Cookie', cookies);

    const membershipCall = fetcher.mock.calls.find(([input]) =>
      String(input).includes('/users/@me/guilds/408711970305474560/member'),
    );
    expect(membershipCall).toBeDefined();
    const headers = (membershipCall?.[1] as RequestInit | undefined)?.headers;
    const authorization =
      headers instanceof Headers
        ? headers.get('Authorization')
        : (headers as Record<string, string> | undefined)?.Authorization;
    expect(authorization).toBe('Bearer oauth-user-token');
    expect((callback.headers['set-cookie'] ?? []).join(';')).not.toMatch(/session_token=/i);

    const context = await auth.$context;
    expect(await context.adapter.findMany({ model: 'user' })).toHaveLength(0);
    expect(await context.adapter.findMany({ model: 'account' })).toHaveLength(0);
    expect(await context.adapter.findMany({ model: 'session' })).toHaveLength(0);
  });
});
