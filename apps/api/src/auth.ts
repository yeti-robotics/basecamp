import { Logger } from '@nestjs/common';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { ConfigService } from '@nestjs/config';
import { type Auth as BetterAuthInstance, type BetterAuthOptions, betterAuth } from 'better-auth';
import { admin } from 'better-auth/plugins';
import type { DiscordProfile } from 'better-auth/social-providers';
import { AccessService } from './access/access.service.js';
import type {
  DiscordAdmissionResult,
  DiscordAdmissionService,
} from './auth/discord-admission.service.js';
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

export function createAuth(
  database: AppDatabase,
  config: ConfigService,
  admission: DiscordAdmissionService,
  access: Pick<AccessService, 'isDiscordIdentitySuspended'>,
): BetterAuthInstance {
  const logger = new Logger('Auth');
  const secret = requiredSetting(config, 'BETTER_AUTH_SECRET');
  if (secret.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters');
  }

  const baseURL = requiredSetting(config, 'BETTER_AUTH_URL');
  requiredHttpUrl(config, 'BETTER_AUTH_URL');
  const clientId = requiredSetting(config, 'DISCORD_CLIENT_ID');
  const clientSecret = requiredSetting(config, 'DISCORD_CLIENT_SECRET');
  const mapDiscordProfileToUser = (profile: DiscordProfile) => {
    const email = typeof profile.email === 'string' ? profile.email.trim() : '';
    return {
      email: email || `discord-${profile.id}@users.invalid`,
      emailVerified: Boolean(email && profile.verified),
    };
  };

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
        scope: ['identify', 'email', 'guilds.members.read'],
        mapProfileToUser: mapDiscordProfileToUser,
        getUserInfo: async (tokens) => {
          const accessToken = tokens.accessToken?.trim();
          if (!accessToken) return null;

          let response: Response;
          try {
            response = await fetch('https://discord.com/api/users/@me', {
              headers: { Authorization: `Bearer ${accessToken}` },
              signal: AbortSignal.timeout(5_000),
            });
          } catch {
            return null;
          }
          if (!response.ok) return null;

          let rawProfile: unknown;
          try {
            rawProfile = await response.json();
          } catch {
            return null;
          }
          if (
            typeof rawProfile !== 'object' ||
            rawProfile === null ||
            !('id' in rawProfile) ||
            typeof rawProfile.id !== 'string' ||
            !/^\d{17,20}$/.test(rawProfile.id) ||
            !('username' in rawProfile) ||
            typeof rawProfile.username !== 'string'
          ) {
            return null;
          }

          const profile = rawProfile as DiscordProfile;
          const avatar = typeof profile.avatar === 'string' ? profile.avatar : null;
          const discriminator =
            typeof profile.discriminator === 'string' ? profile.discriminator : '0';
          const image =
            avatar === null
              ? `https://cdn.discordapp.com/embed/avatars/${
                  discriminator === '0'
                    ? Number(BigInt(profile.id) >> 22n) % 6
                    : (Number.parseInt(discriminator, 10) || 0) % 5
                }.png`
              : `https://cdn.discordapp.com/avatars/${profile.id}/${avatar}.${avatar.startsWith('a_') ? 'gif' : 'png'}`;
          const admissionResult: DiscordAdmissionResult = await admission.verify(
            accessToken,
            profile.id,
          );
          const mappedUser = mapDiscordProfileToUser(profile);

          return {
            user: {
              name: profile.global_name || profile.username || '',
              image,
              ...mappedUser,
            },
            data: {
              ...profile,
              image_url: image,
              basecampAdmissionResult: admissionResult,
            },
          };
        },
      },
    },
    user: {
      validateUserInfo: async ({ source }) => {
        if (source.method !== 'oauth' || source.oauth?.providerId !== 'discord') return;
        const profile = source.oauth.profile;
        const discordId = profile?.id;
        if (!profile || typeof discordId !== 'string' || !/^\d{17,20}$/.test(discordId)) {
          return {
            error: 'discord_identity_unavailable',
            errorDescription: 'Discord did not provide a valid account identity.',
          };
        }

        const result = profile.basecampAdmissionResult;
        if (result === 'allowed') {
          if (await access.isDiscordIdentitySuspended(discordId)) {
            return {
              error: 'basecamp_account_suspended',
              errorDescription: 'This Basecamp account is suspended. Contact a Team Admin.',
            };
          }
          return;
        }
        if (result === 'denied') {
          return {
            error: 'discord_guild_membership_required',
            errorDescription: "Your Discord account must belong to this team's configured server.",
          };
        }
        return {
          error: 'discord_admission_unavailable',
          errorDescription:
            'Basecamp could not verify server membership. Try again later; if this continues, reconnect Discord and grant server-membership access.',
        };
      },
    },
    plugins: [admin()],
  };
  return betterAuth(options);
}

export type Auth = BetterAuthInstance;