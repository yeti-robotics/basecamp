import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { ConfigService } from '@nestjs/config';
import { type Auth as BetterAuthInstance, type BetterAuthOptions, betterAuth } from 'better-auth';
import { admin } from 'better-auth/plugins';
import type { AppDatabase } from './database/database.service.js';
import * as schema from './database/schema/auth.js';

function requiredSetting(config: ConfigService, key: string): string {
  const value = config.get<string>(key);
  if (!value?.trim()) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function requiredHttpUrl(config: ConfigService, key: string): URL {
  const setting = requiredSetting(config, key);
  let url: URL;
  try {
    url = new URL(setting);
  } catch {
    throw new Error(`${key} must be an HTTP(S) URL`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${key} must be an HTTP(S) URL`);
  }
  return url;
}

export function createAuth(database: AppDatabase, config: ConfigService): BetterAuthInstance {
  const secret = requiredSetting(config, 'BETTER_AUTH_SECRET');
  if (secret.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters');
  }

  const baseURL = requiredSetting(config, 'BETTER_AUTH_URL');
  requiredHttpUrl(config, 'BETTER_AUTH_URL');
  const dashboardOrigin = requiredHttpUrl(config, 'DASHBOARD_URL').origin;
  const clientId = requiredSetting(config, 'DISCORD_CLIENT_ID');
  const clientSecret = requiredSetting(config, 'DISCORD_CLIENT_SECRET');

  const options: BetterAuthOptions = {
    baseURL,
    secret,
    trustedOrigins: [dashboardOrigin],
    database: drizzleAdapter(database, {
      provider: 'pg',
      schema,
    }),
    emailAndPassword: {
      enabled: false,
    },
    socialProviders: {
      discord: {
        clientId,
        clientSecret,
      },
    },
    plugins: [admin()],
  };
  return betterAuth(options);
}

export type Auth = BetterAuthInstance;
