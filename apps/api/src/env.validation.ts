import { decodeSeed } from '@repo/attendance-code';
import { z } from 'zod';

const nonblank = z.string().trim().min(1);
const optionalNonblank = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const httpUrl = z.url({ protocol: /^https?$/, hostname: /.+/ }).trim();
const postgresUrl = z.url({ protocol: /^postgres(?:ql)?$/, hostname: /.+/ }).trim();
const bootstrapDiscordIds = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined)
  .refine(
    (value) => value === undefined || value.split(',').every((id) => /^\d{17,20}$/.test(id.trim())),
    'BASECAMP_BOOTSTRAP_ADMIN_DISCORD_IDS must be a comma-separated list of Discord snowflakes',
  );

export const envSchema = z
  .object({
    DATABASE_URL: postgresUrl,
    BETTER_AUTH_SECRET: z.string().trim().min(32),
    BETTER_AUTH_URL: httpUrl,
    ATTENDANCE_DISPLAY_PASSWORD: z.string().trim().min(1),
    ATTENDANCE_DISPLAY_SESSION_SECRET: z.string().min(32),
    ATTENDANCE_TRUSTED_PROXY: optionalNonblank,
    ATTENDANCE_TOTP_SECRET: z.string().refine((value) => {
      try {
        decodeSeed(value);
        return true;
      } catch {
        return false;
      }
    }, 'ATTENDANCE_TOTP_SECRET must be a Base32 seed of at least 20 bytes'),
    DISCORD_CLIENT_ID: nonblank,
    DISCORD_CLIENT_SECRET: nonblank,
    DISCORD_GUILD_ID: z
      .string()
      .regex(/^\d{17,20}$/, 'DISCORD_GUILD_ID must be a Discord snowflake'),
    DISCORD_ADMISSION_BOT_TOKEN: nonblank,
    BASECAMP_BOOTSTRAP_ADMIN_DISCORD_IDS: bootstrapDiscordIds,
    DISCORD_TOKEN: optionalNonblank,
    DISCORD_DEVELOPMENT_GUILD_ID: optionalNonblank,
    PORT: z.coerce.number().int().min(1).max(65535).default(8000),
  })
  .superRefine((settings, context) => {
    if (Boolean(settings.DISCORD_TOKEN) !== Boolean(settings.DISCORD_DEVELOPMENT_GUILD_ID)) {
      context.addIssue({
        code: 'custom',
        path: ['DISCORD_TOKEN'],
        message: 'DISCORD_TOKEN and DISCORD_DEVELOPMENT_GUILD_ID must be set together',
      });
    }
  });

export type ApiEnv = z.infer<typeof envSchema>;
