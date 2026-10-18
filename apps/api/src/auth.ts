import { Logger } from '@nestjs/common';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { ConfigService } from '@nestjs/config';
import { type Auth as BetterAuthInstance, type BetterAuthOptions, betterAuth } from 'better-auth';
import { admin } from 'better-auth/plugins';
import type { AppDatabase } from './database/database.service.js';
import * as schema from './database/schema/auth.js';
import { ensureSeasonMembership } from './auth/ensure-season-membership.js';

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
  const logger = new Logger('Auth');
  const secret = requiredSetting(config, 'BETTER_AUTH_SECRET');
  if (secret.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters');
  }

  const baseURL = requiredSetting(config, 'BETTER_AUTH_URL');
  requiredHttpUrl(config, 'BETTER_AUTH_URL');
  const clientId = requiredSetting(config, 'DISCORD_CLIENT_ID');
  const clientSecret = requiredSetting(config, 'DISCORD_CLIENT_SECRET');

  const options: BetterAuthOptions = {
    baseURL,
    secret,
    database: drizzleAdapter(database, {
      provider: 'pg',
      schema,
    }),
    databaseHooks: {
      session: {
        create: {
          after: async (session) => {
            try {
              const hasActiveSeason = await ensureSeasonMembership(
                database,
                session.userId,
              );

              if (!hasActiveSeason) {
                logger.warn(
                  `No active season found while creating a membership for user ${session.userId}`,
                );
              }
            } catch (error) {
              const message =
                error instanceof Error ? error.message : String(error);
              logger.error(
                `Could not create a season membership for user ${session.userId}: ${message}`,
              );
            }
          },
        },
      },
    },
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