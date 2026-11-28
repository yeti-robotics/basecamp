import { Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { err, ok, Result, ResultAsync } from 'neverthrow';

import { DatabaseService } from '../database/database.service.js';
import {
  account,
  attendance,
  attendanceAudit,
  hour_requirements,
  season_memberships,
} from '../database/schema/index.js';
import { type Attendance, AttendanceSchema } from './attendance.schema.js';

export type AttendanceCreate = {
  userId: string;
  checkedInAt: Date;
  category: 'meeting' | 'outreach';
  eventId: number | null;
};

export type AttendanceUpdate = {
  checkedInAt?: Date;
  checkedOutAt?: Date | null;
  category?: 'meeting' | 'outreach';
  eventId?: number | null;
};

export type AttendanceAuditContext = {
  actorUserId: string;
  action: 'mentor_signed_in' | 'mentor_signed_out' | 'stale_session_credited';
  reason: string;
};

function auditSnapshot(row: typeof attendance.$inferSelect) {
  return {
    userId: row.user_id,
    checkedInAt: row.checked_in_at.toISOString(),
    checkedOutAt: row.checked_out_at?.toISOString() ?? null,
    category: row.category,
    eventId: row.event_id,
    status: row.status,
  };
}

type MembershipRequirementFields = Pick<
  typeof season_memberships.$inferSelect,
  'role' | 'student_experience' | 'legacy_status'
>;

export function getRequirementStatus(
  membership: MembershipRequirementFields,
): typeof hour_requirements.$inferSelect.status | null {
  if (membership.role === 'mentor' || membership.role === 'team_admin') {
    return 'mentor';
  }

  return membership.student_experience;
}

@Injectable()
export class AttendanceRepository {
  private readonly logger = new Logger(AttendanceRepository.name);

  constructor(private readonly database: DatabaseService) {}

  getLast(userId: string): ResultAsync<Attendance | null, Error> {
    return ResultAsync.fromPromise<(typeof attendance.$inferSelect)[], Error>(
      this.database.db
        .select()
        .from(attendance)
        .where(eq(attendance.user_id, userId))
        .orderBy(desc(attendance.checked_in_at))
        .limit(1),
      (error) => (error instanceof Error ? error : new Error(String(error))),
    ).andThen((result) => this.parseRow(result[0]));
  }

  createRecord(
    record: AttendanceCreate,
    audit?: AttendanceAuditContext,
  ): ResultAsync<Attendance, Error> {
    return ResultAsync.fromPromise<(typeof attendance.$inferSelect)[], Error>(
      this.database.db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${record.userId}, 0))`);

        const [last] = await tx
          .select({ checked_out_at: attendance.checked_out_at })
          .from(attendance)
          .where(eq(attendance.user_id, record.userId))
          .orderBy(desc(attendance.checked_in_at))
          .limit(1);

        if (last && last.checked_out_at === null) {
          throw new Error('User is already signed in');
        }

        const [created] = await tx
          .insert(attendance)
          .values({
            user_id: record.userId,
            checked_in_at: record.checkedInAt,
            checked_out_at: null,
            category: record.category,
            event_id: record.eventId,
          })
          .returning();
        if (created && audit) {
          await tx.insert(attendanceAudit).values({
            attendance_id: created.id,
            actor_user_id: audit.actorUserId,
            subject_user_id: record.userId,
            action: audit.action,
            before: null,
            after: auditSnapshot(created),
            reason: audit.reason,
          });
        }
        return created ? [created] : [];
      }),
      (error) => (error instanceof Error ? error : new Error(String(error))),
    ).andThen((rows) =>
      this.parseRow(rows[0]).andThen((row) =>
        row ? ok(row) : err(new Error('Attendance record was not created')),
      ),
    );
  }

  updateLast(
    userId: string,
    updates: AttendanceUpdate,
    audit?: AttendanceAuditContext,
  ): ResultAsync<Attendance | null, Error> {
    const setObject: Partial<typeof attendance.$inferInsert> = {};

    if (updates.checkedInAt !== undefined) {
      setObject.checked_in_at = updates.checkedInAt;
    }
    if (updates.checkedOutAt !== undefined) {
      setObject.checked_out_at = updates.checkedOutAt;
    }
    if (updates.category !== undefined) {
      setObject.category = updates.category;
    }
    if (updates.eventId !== undefined) {
      setObject.event_id = updates.eventId;
    }

    return ResultAsync.fromPromise<(typeof attendance.$inferSelect)[], Error>(
      this.database.db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`);

        const [last] = await tx
          .select()
          .from(attendance)
          .where(eq(attendance.user_id, userId))
          .orderBy(desc(attendance.checked_in_at))
          .limit(1);

        if (!last) {
          throw new Error('No attendance record found to update');
        }

        const condition =
          updates.checkedOutAt != null
            ? and(eq(attendance.id, last.id), isNull(attendance.checked_out_at))
            : eq(attendance.id, last.id);

        const [updated] = await tx.update(attendance).set(setObject).where(condition).returning();
        if (updated && audit) {
          await tx.insert(attendanceAudit).values({
            attendance_id: updated.id,
            actor_user_id: audit.actorUserId,
            subject_user_id: userId,
            action: audit.action,
            before: auditSnapshot(last),
            after: auditSnapshot(updated),
            reason: audit.reason,
          });
        }
        return updated ? [updated] : [];
      }),
      (error) => (error instanceof Error ? error : new Error(String(error))),
    ).andThen((result) =>
      this.parseRow(result[0]).andThen((row) =>
        row ? ok(row) : err(new Error('Attendance record was not updated')),
      ),
    );
  }

  private parseRow(
    row: typeof attendance.$inferSelect | undefined,
  ): Result<Attendance | null, Error> {
    if (!row) {
      return ok(null);
    }

    const parseableRow = {
      id: row.id,
      userId: row.user_id,
      checkedInAt: row.checked_in_at.toISOString(),
      checkedOutAt: row.checked_out_at ? row.checked_out_at.toISOString() : null,
      category: row.category,
      eventId: row.event_id,
    };

    const parsed = AttendanceSchema.safeParse(parseableRow);

    if (!parsed.success) {
      this.logger.error(`Invalid attendance row: ${parsed.error.message}`);
      return err(parsed.error);
    }

    return ok(parsed.data);
  }

  getUserIdByDiscordId(discordId: string): ResultAsync<string, Error> {
    return ResultAsync.fromPromise<{ userId: string }[], Error>(
      this.database.db
        .select({ userId: account.userId })
        .from(account)
        .where(and(eq(account.accountId, discordId), eq(account.providerId, 'discord')))
        .limit(1),
      (error) => (error instanceof Error ? error : new Error(String(error))),
    ).andThen((result) => {
      if (!result.length) {
        return err(new Error('User not found'));
      }

      return ok(result[0].userId);
    });
  }
}
