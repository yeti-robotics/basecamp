import { z } from 'zod';

const nonblank = z.string().trim().min(1);
const optionalNonblank = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const httpUrl = z.url({ protocol: /^https?$/, hostname: /.+/ }).trim();
const postgresUrl = z.url({ protocol: /^postgres(?:ql)?$/, hostname: /.+/ }).trim();

export const envSchema = z
  .object({
    DATABASE_URL: postgresUrl,
    BETTER_AUTH_SECRET: z.string().trim().min(32),
    BETTER_AUTH_URL: httpUrl,
    DISCORD_CLIENT_ID: nonblank,
    DISCORD_CLIENT_SECRET: nonblank,
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
