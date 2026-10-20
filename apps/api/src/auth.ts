import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { ConfigService } from '@nestjs/config';
import { type Auth as BetterAuthInstance, type BetterAuthOptions, betterAuth } from 'better-auth';
import { admin } from 'better-auth/plugins';
import type { DiscordAdmissionService } from './auth/discord-admission.service.js';
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

export function createAuth(
  database: AppDatabase,
  config: ConfigService,
  admission: DiscordAdmissionService,
): BetterAuthInstance {
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
    emailAndPassword: {
      enabled: false,
    },
    socialProviders: {
      discord: {
        clientId,
        clientSecret,
        mapProfileToUser: (profile) => {
          const email = typeof profile.email === 'string' ? profile.email.trim() : '';
          return {
            email: email || `discord-${profile.id}@users.invalid`,
            emailVerified: Boolean(email && profile.verified),
          };
        },
      },
    },
    user: {
      validateUserInfo: async ({ source }) => {
        if (source.method !== 'oauth' || source.oauth?.providerId !== 'discord') return;
        const discordId = source.oauth.profile?.id;
        if (typeof discordId !== 'string') {
          return {
            error: 'discord_identity_unavailable',
            errorDescription: 'Discord did not provide a valid account identity.',
          };
        }

        const result = await admission.verify(discordId);
        if (result === 'allowed') return;
        if (result === 'denied') {
          return {
            error: 'discord_guild_membership_required',
            errorDescription: "Your Discord account must belong to this team's configured server.",
          };
        }
        return {
          error: 'discord_admission_unavailable',
          errorDescription: 'Basecamp could not verify team server membership. Try again later.',
        };
      },
    },
    plugins: [admin()],
  };
  return betterAuth(options);
}

export type Auth = BetterAuthInstance;
