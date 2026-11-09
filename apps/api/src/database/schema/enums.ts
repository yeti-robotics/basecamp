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
export const eventType = pgEnum('event_type', ['meeting', 'extra_meeting', 'outreach', 'other']);
export const eventHourCategory = pgEnum('event_hour_category', ['meeting', 'outreach', 'none']);
export const eventStatus = pgEnum('event_status', ['scheduled', 'cancelled']);
export const attendanceStatus = pgEnum('attendance_status', ['normal', 'manual', 'excused']);

export type SeasonRole = (typeof seasonRole.enumValues)[number];
export type StudentExperience = (typeof studentExperience.enumValues)[number];
export type MembershipState = (typeof membershipState.enumValues)[number];
export type AttendanceStatus = (typeof attendanceStatus.enumValues)[number];
