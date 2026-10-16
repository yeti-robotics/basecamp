import { sql } from 'drizzle-orm';
import {
  check,
  date,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { user } from './auth.js';
import { memberStatus, membershipState, seasonRole, studentExperience } from './enums.js';

export const seasons = pgTable(
  'seasons',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    starts_on: date('starts_on').notNull(),
    ends_on: date('ends_on').notNull(),
    // Kept while existing attendance views still use timestamp-based season bounds.
    started_at: timestamp('started_at').notNull(),
    ended_at: timestamp('ended_at').notNull(),
  },
  (table) => [check('seasons_dates_ordered_check', sql`${table.ends_on} >= ${table.starts_on}`)],
);

export const season_memberships = pgTable(
  'season_memberships',
  {
    id: serial('id').primaryKey(),
    season_id: integer('season_id')
      .notNull()
      .references(() => seasons.id),
    user_id: text('user_id')
      .notNull()
      .references(() => user.id),
    role: seasonRole('role').notNull(),
    student_experience: studentExperience('student_experience'),
    state: membershipState('state').notNull().default('active'),
    joined_at: timestamp('joined_at').defaultNow().notNull(),
    removed_at: timestamp('removed_at'),
    legacy_status: memberStatus('legacy_status'),
    // Legacy timing fields remain for the existing attendance summary until its date model is updated.
    started_at: timestamp('started_at').defaultNow().notNull(),
    ended_at: timestamp('ended_at'),
    status_override: text('status_override'),
  },
  (table) => [
    uniqueIndex('season_memberships_season_user_uidx').on(table.season_id, table.user_id),
    check(
      'season_memberships_experience_role_check',
      sql`(${table.role} in ('student', 'student_leader') and ${table.student_experience} is not null) or (${table.role} in ('team_admin', 'mentor') and ${table.student_experience} is null)`,
    ),
    check(
      'season_memberships_state_timestamp_check',
      sql`(${table.state} = 'active' and ${table.removed_at} is null) or (${table.state} = 'removed' and ${table.removed_at} is not null)`,
    ),
  ],
);
