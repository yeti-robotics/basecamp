import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth.js';
import { eventHourCategory, eventStatus, eventType } from './enums.js';
import { seasons } from './seasons.js';

export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  season_id: integer('season_id')
    .notNull()
    .references(() => seasons.id),
  name: text('name').notNull(),
  description: text('description'),
  location: text('location').notNull(),
  starts_at: timestamp('starts_at').notNull(),
  ends_at: timestamp('ends_at').notNull(),
  event_type: eventType('event_type').notNull(),
  hour_category: eventHourCategory('hour_category').notNull(),
  status: eventStatus('status').notNull().default('scheduled'),
  created_by: text('created_by').references(() => user.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});
