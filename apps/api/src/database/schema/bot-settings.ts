import { sql } from 'drizzle-orm';
import { boolean, check, integer, pgTable, text } from 'drizzle-orm/pg-core';

export const bot_settings = pgTable(
  'bot_settings',
  {
    id: integer('id').primaryKey().default(1),
    enabled: boolean('enabled').notNull().default(false),
    token_ciphertext: text('token_ciphertext'),
  },
  (table) => [check('bot_settings_singleton_check', sql`${table.id} = 1`)],
);
