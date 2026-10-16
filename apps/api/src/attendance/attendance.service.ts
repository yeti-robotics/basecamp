import { Injectable } from '@nestjs/common';
import { and, desc, eq, gt, gte, isNull, lte, or } from 'drizzle-orm';
import { err, errAsync, fromThrowable, ok, okAsync, type Result, ResultAsync } from 'neverthrow';
import { DatabaseService } from '../database/database.service.js';
import { attendance, hour_requirements } from '../database/schema/attendance.js';
import { events } from '../database/schema/events.js';
import { season_memberships, seasons } from '../database/schema/seasons.js';
import { FORGOT_SIGNOUT_CREDIT_MS, STALE_SIGNIN_MIN_HOURS_MS } from './attendance.constants.js';
import { AttendanceRepository, type AttendanceUpdate } from './attendance.repository.js';
import { Attendance } from './attendance.schema.js';
import { AttendanceCodeService } from './attendance-code.service.js';

type AttendanceRecord = {
  id: number;
  category: 'meeting' | 'outreach';
  checkedInAt: Date;
  checkedOutAt: Date | null;
  name: string | null;
};

// Count completed sessions only; an open sign-in is shown as in progress.
export function completedHours(record: AttendanceRecord, start: Date, end: Date): number {
  if (!record.checkedOutAt) return 0;
  const milliseconds =
    Math.min(record.checkedOutAt.getTime(), end.getTime()) -
    Math.max(record.checkedInAt.getTime(), start.getTime());
  return Math.max(0, milliseconds / 3_600_000);
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly attendanceRepository: AttendanceRepository,
    private readonly database: DatabaseService,
    private readonly codeService: AttendanceCodeService,
  ) {}

  public signInWithCode(discordId: string, code: string): ResultAsync<void, Error> {
    return ResultAsync.fromPromise(
      this.codeService.verify(code),
      (error) => new Error(String(error)),
    ).andThen((valid) =>
      valid
        ? this.recordAttendance(discordId, 'meeting', null)
        : errAsync(new Error('Invalid attendance code')),
    );
  }

  public signOutWithCode(discordId: string, code: string): ResultAsync<void, Error> {
    return ResultAsync.fromPromise(
      this.codeService.verify(code),
      (error) => new Error(String(error)),
    ).andThen((valid) =>
      valid
        ? this.updateAttendance(discordId, { checkedOutAt: new Date() })
        : errAsync(new Error('Invalid attendance code')),
    );
  }

  public recordAttendance(
    discordId: string,
    category: 'meeting' | 'outreach',
    eventId: number | null,
    checkedInAt: Date = new Date(),
  ): ResultAsync<void, Error> {
    return this.attendanceRepository.getUserIdByDiscordId(discordId).andThen((userId) => {
      return this.attendanceRepository.getLast(userId).andThen((attendance) => {
        if (attendance && attendance.checkedOutAt === null) {
          const staleResult = this.isStaleSession(new Date(attendance.checkedInAt));
          if (staleResult.isErr()) {
            return errAsync(staleResult.error);
          }

          if (!staleResult.value) {
            return errAsync(new Error('User is already signed in'));
          }

          return this.handleForgotToSignOut(discordId).andThen(() =>
            this.attendanceRepository
              .createRecord({ userId, checkedInAt, category, eventId })
              .map(() => undefined),
          );
        }

        return this.attendanceRepository
          .createRecord({ userId, checkedInAt, category, eventId })
          .map(() => undefined);
      });
    });
  }

  public updateAttendance(discordId: string, updates: AttendanceUpdate): ResultAsync<void, Error> {
    return this.attendanceRepository.getUserIdByDiscordId(discordId).andThen((userId) => {
      if (updates.checkedOutAt === undefined || updates.checkedOutAt === null) {
        return this.attendanceRepository.updateLast(userId, updates).map(() => undefined);
      }

      return this.attendanceRepository.getLast(userId).andThen((attendance) => {
        if (!attendance) {
          return errAsync(new Error('User was not signed out because they have not signed in yet'));
        }

        if (attendance.checkedOutAt !== null) {
          return errAsync(new Error('User is already signed out'));
        }

        return this.attendanceRepository.updateLast(userId, updates).map(() => undefined);
      });
    });
  }

  private isStaleSession(signInTime: Date): Result<boolean, Error> {
    const toEasternYMD = fromThrowable(
      (date: Date) => {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).formatToParts(date);
        const getPart = (type: 'year' | 'month' | 'day') => {
          const part = parts.find((p) => p.type === type);
          if (part == null) throw new Error(`Missing ${type} in date parts`);
          return Number(part.value);
        };
        return { year: getPart('year'), month: getPart('month'), day: getPart('day') };
      },
      (e) => (e instanceof Error ? e : new Error(String(e))),
    );

    const now = new Date();
    const signInResult = toEasternYMD(signInTime);
    if (signInResult.isErr()) return err(signInResult.error);
    const nowResult = toEasternYMD(now);
    if (nowResult.isErr()) return err(nowResult.error);

    const signInEastern = signInResult.value;
    const nowEastern = nowResult.value;

    const differentDay =
      nowEastern.year !== signInEastern.year ||
      nowEastern.month !== signInEastern.month ||
      nowEastern.day !== signInEastern.day;
    const enoughTimeElapsed = now.getTime() - signInTime.getTime() > STALE_SIGNIN_MIN_HOURS_MS;
    return ok(differentDay && enoughTimeElapsed);
  }

  // resolve stale session
  public handleForgotToSignOut(discordId: string): ResultAsync<Attendance, Error> {
    return this.attendanceRepository.getUserIdByDiscordId(discordId).andThen((userId) => {
      return this.attendanceRepository.getLast(userId).andThen((attendance) => {
        if (!attendance) {
          return errAsync(new Error('No attendance record found for user'));
        }

        if (attendance.checkedOutAt !== null) {
          return okAsync(attendance);
        }

        const staleResult = this.isStaleSession(new Date(attendance.checkedInAt));
        if (staleResult.isErr()) {
          return errAsync(staleResult.error);
        }
        if (!staleResult.value) {
          return okAsync(attendance);
        }

        const creditTime = new Date(
          new Date(attendance.checkedInAt).getTime() + FORGOT_SIGNOUT_CREDIT_MS,
        );

        return this.attendanceRepository
          .updateLast(userId, { checkedOutAt: creditTime })
          .andThen((updated) => {
            if (!updated) {
              return errAsync(new Error('Failed to credit forgotten sign-out'));
            }
            return okAsync(updated);
          });
      });
    });
  }

  async overview(userId: string, now = new Date()) {
    const db = this.database.db;
    const [season] = await db
      .select()
      .from(seasons)
      .where(and(lte(seasons.started_at, now), gt(seasons.ended_at, now)))
      .orderBy(desc(seasons.started_at))
      .limit(1);
    if (!season)
      return {
        season: null,
        hours: { meeting: 0, outreach: 0, total: 0 },
        requirements: null,
        recentActivity: [],
      };

    const [records, memberships] = await Promise.all([
      db
        .select({
          id: attendance.id,
          category: attendance.category,
          checkedInAt: attendance.checked_in_at,
          checkedOutAt: attendance.checked_out_at,
          name: events.name,
        })
        .from(attendance)
        .leftJoin(events, eq(attendance.event_id, events.id))
        .where(
          and(
            eq(attendance.user_id, userId),
            lte(attendance.checked_in_at, now),
            or(
              and(
                isNull(attendance.checked_out_at),
                gte(attendance.checked_in_at, season.started_at),
              ),
              gt(attendance.checked_out_at, season.started_at),
            ),
            lte(attendance.checked_in_at, season.ended_at),
          ),
        )
        .orderBy(desc(attendance.checked_in_at), desc(attendance.id)),
      db
        .select()
        .from(season_memberships)
        .where(
          and(
            eq(season_memberships.user_id, userId),
            eq(season_memberships.season_id, season.id),
            lte(season_memberships.started_at, now),
            or(isNull(season_memberships.ended_at), gt(season_memberships.ended_at, now)),
          ),
        )
        .orderBy(desc(season_memberships.started_at))
        .limit(1),
    ]);
    const membership = memberships[0];
    // Memberships currently have no leadership flag; use the standard member requirements.
    const requirements = membership?.legacy_status
      ? await db
          .select()
          .from(hour_requirements)
          .where(
            and(
              eq(hour_requirements.season_id, season.id),
              eq(hour_requirements.status, membership.legacy_status),
              eq(hour_requirements.is_leader, false),
            ),
          )
      : [];
    const hours = { meeting: 0, outreach: 0, total: 0 };
    for (const record of records)
      hours[record.category] += completedHours(record, season.started_at, now);
    hours.total = hours.meeting + hours.outreach;
    return {
      season: { id: season.id, name: season.name },
      hours,
      requirements: membership
        ? {
            meeting: requirements.find((row) => row.category === 'meeting')?.required_hours ?? null,
            outreach:
              requirements.find((row) => row.category === 'outreach')?.required_hours ?? null,
          }
        : null,
      recentActivity: records.slice(0, 5).map((record) => ({
        id: record.id,
        category: record.category,
        name: record.name ?? (record.category === 'meeting' ? 'Team meeting' : 'Outreach event'),
        checkedInAt: record.checkedInAt.toISOString(),
        checkedOutAt: record.checkedOutAt?.toISOString() ?? null,
        hours: completedHours(record, season.started_at, now),
      })),
    };
  }
}
