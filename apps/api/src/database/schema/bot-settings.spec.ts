import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { bot_settings } from './bot-settings.js';

describe('bot settings schema', () => {
  it('uses a singleton row with disabled-by-default state and encrypted token storage', () => {
    const config = getTableConfig(bot_settings);

    expect(config.name).toBe('bot_settings');
    expect(bot_settings.id.primary).toBe(true);
    expect(bot_settings.enabled.notNull).toBe(true);
    expect(bot_settings.enabled.default).toBe(false);
    expect(bot_settings.token_ciphertext.name).toBe('token_ciphertext');
    expect(bot_settings.token_ciphertext.notNull).toBe(false);
    expect(bot_settings.status_message.notNull).toBe(true);
    expect(bot_settings.status_message.default).toBe('YETI ARE YOU READY?');
    expect(config.checks.map((check) => check.name)).toContain('bot_settings_singleton_check');
  });
});
