import { pgEnum } from 'drizzle-orm/pg-core';

export const memberStatus = pgEnum('member_status', ['rookie', 'veteran', 'alumni', 'mentor']);

export const seasonRole = pgEnum('season_role', [
  'team_admin',
  'mentor',
  'student_leader',
  'student',
]);
export const studentExperience = pgEnum('student_experience', ['rookie', 'veteran']);
export const membershipState = pgEnum('membership_state', ['active', 'removed']);

export const eventCategory = pgEnum('event_category', ['meeting', 'outreach']);

export type SeasonRole = (typeof seasonRole.enumValues)[number];
export type StudentExperience = (typeof studentExperience.enumValues)[number];
export type MembershipState = (typeof membershipState.enumValues)[number];
