import { sql } from 'drizzle-orm';
import { boolean, check, integer, pgTable, text } from 'drizzle-orm/pg-core';

export const DEFAULT_BOT_STATUS_MESSAGE = 'YETI ARE YOU READY?';

export const bot_settings = pgTable(
  'bot_settings',
  {
    id: integer('id').primaryKey().default(1),
    enabled: boolean('enabled').notNull().default(false),
    token_ciphertext: text('token_ciphertext'),
    status_message: text('status_message').notNull().default(DEFAULT_BOT_STATUS_MESSAGE),
  },
  (table) => [check('bot_settings_singleton_check', sql`${table.id} = 1`)],
);
