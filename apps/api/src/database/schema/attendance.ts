import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { user } from './auth.js';
import { attendanceStatus, eventCategory, memberStatus } from './enums.js';
import { events } from './events.js';
import { seasons } from './seasons.js';

export const attendance = pgTable('attendance', {
  id: serial('id').primaryKey(),
  user_id: text('user_id').references(() => user.id),
  event_id: integer('event_id').references(() => events.id),
  checked_in_at: timestamp('checked_in_at').notNull(),
  checked_out_at: timestamp('checked_out_at'),
  category: eventCategory('category').notNull(),
  // normal: recorded by sign-in; manual: added by a mentor; excused: mentor-credited absence.
  status: attendanceStatus('status').notNull().default('normal'),
});

export const attendanceAudit = pgTable(
  'attendance_audit',
  {
    id: serial('id').primaryKey(),
    attendance_id: integer('attendance_id')
      .notNull()
      .references(() => attendance.id),
    actor_user_id: text('actor_user_id').references(() => user.id),
    subject_user_id: text('subject_user_id').references(() => user.id),
    action: text('action').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    reason: text('reason').notNull(),
    created_at: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('attendance_audit_attendance_id_idx').on(table.attendance_id)],
);

export const hour_requirements = pgTable(
  'hour_requirements',
  {
    id: serial('id').primaryKey(),
    season_id: integer('season_id')
      .references(() => seasons.id)
      .notNull(),
    status: memberStatus('status').notNull(),
    is_leader: boolean('is_leader').notNull(),
    category: eventCategory('category').notNull(),
    required_hours: integer('required_hours').notNull(),
  },
  (table) => [
    uniqueIndex('hour_requirements_season_status_leader_category_uidx').on(
      table.season_id,
      table.status,
      table.is_leader,
      table.category,
    ),
    check('hour_requirements_required_hours_nonnegative', sql`${table.required_hours} >= 0`),
  ],
);
