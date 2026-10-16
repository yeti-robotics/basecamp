import { integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth.js';
import { seasons } from './seasons.js';

export const rosterAudit = pgTable('roster_audit', {
  id: serial('id').primaryKey(),
  // Null actor is reserved for system migrations; user actions must set an actor.
  actor_user_id: text('actor_user_id').references(() => user.id),
  subject_user_id: text('subject_user_id')
    .notNull()
    .references(() => user.id),
  season_id: integer('season_id').references(() => seasons.id),
  action: text('action').notNull(),
  before: jsonb('before'),
  after: jsonb('after'),
  reason: text('reason'),
  created_at: timestamp('created_at').defaultNow().notNull(),
});
