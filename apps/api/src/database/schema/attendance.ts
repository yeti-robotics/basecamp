import {
  pgTable,
  timestamp,
  serial,
  text,
  integer,
  boolean,
} from 'drizzle-orm/pg-core';
import { events } from './events.js';
import { seasons } from './seasons.js';
import { memberStatus } from './enums.js';
import { eventCategory } from './enums.js';
import { user } from './auth.js';

export const attendance = pgTable('attendance', {
  id: serial('id').primaryKey(),
  user_id: text('user_id').references(() => user.id),
  event_id: integer('event_id').references(() => events.id),
  checked_in_at: timestamp('checked_in_at').notNull(),
  checked_out_at: timestamp('checked_out_at'),
  category: eventCategory('category').notNull(),
});

export const hour_requirements = pgTable('hour_requirements', {
  id: serial('id').primaryKey(),
  season_id: integer('season_id').references(() => seasons.id),
  status: memberStatus('status').notNull(),
  is_leader: boolean('is_leader').notNull(),
  category: eventCategory('category').notNull(),
  required_hours: integer('required_hours').notNull(),
});
