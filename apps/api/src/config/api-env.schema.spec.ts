import { describe, expect, it } from 'vitest';
import { apiEnvSchema } from './api-env.schema.js';

const valid = {
  DATABASE_URL: 'postgresql://user:password@localhost/basecamp',
  BETTER_AUTH_SECRET: 'test-secret-at-least-thirty-two-characters',
  BETTER_AUTH_URL: 'http://localhost:3000',
  DISCORD_CLIENT_ID: 'client-id',
  DISCORD_CLIENT_SECRET: 'client-secret',
};

describe('API environment schema', () => {
  it('defaults the port and coerces an explicitly configured port', () => {
    expect(apiEnvSchema.parse(valid).PORT).toBe(8000);
    expect(apiEnvSchema.parse({ ...valid, PORT: '3001' }).PORT).toBe(3001);
  });

  it('accepts Discord bot configuration when both settings are present or absent', () => {
    expect(apiEnvSchema.safeParse(valid).success).toBe(true);
    expect(
      apiEnvSchema.safeParse({
        ...valid,
        DISCORD_TOKEN: 'bot-token',
        DISCORD_DEVELOPMENT_GUILD_ID: 'guild-id',
      }).success,
    ).toBe(true);
  });

  it.each([
    ['DATABASE_URL', ''],
    ['DATABASE_URL', 'https://user:secret@example.test/db'],
    ['BETTER_AUTH_SECRET', 'short'],
    ['BETTER_AUTH_SECRET', '                                '],
    ['BETTER_AUTH_URL', ''],
    ['BETTER_AUTH_URL', 'ftp://auth.example.test'],
    ['DISCORD_CLIENT_ID', ' '],
    ['DISCORD_CLIENT_SECRET', ''],
    ['PORT', '0'],
    ['PORT', '65536'],
    ['PORT', '3.5'],
    ['PORT', 'abc'],
    ['DISCORD_TOKEN', 'bot-token'],
    ['DISCORD_DEVELOPMENT_GUILD_ID', 'guild-id'],
  ])('rejects invalid %s configuration', (key, value) => {
    const result = apiEnvSchema.safeParse({ ...valid, [key]: value });
    expect(result.success).toBe(false);
    if (!result.success && key === 'DATABASE_URL') {
      expect(result.error.message).toContain('DATABASE_URL');
      expect(result.error.message).not.toContain('secret');
    }
  });
});
