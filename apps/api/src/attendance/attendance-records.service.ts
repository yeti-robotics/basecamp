import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, gte, ilike, lte, sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service.js';
import {
  type AttendanceStatus,
  attendance,
  attendanceAudit,
  attendanceStatus,
  eventCategory,
  events,
  user,
} from '../database/schema/index.js';
import { SeasonAuthorizationService } from '../seasons/season-authorization.service.js';

type AttendanceCategory = (typeof eventCategory.enumValues)[number];
// `normal` is reserved for rows created by signing in.
type MentorStatus = Exclude<AttendanceStatus, 'normal'>;

export const RECORD_LIST_LIMIT = 200;
const REASON_MAX_LENGTH = 500;
const SEARCH_MAX_LENGTH = 100;

export interface AttendanceRecordFilter {
  q?: string;
  from?: string;
  to?: string;
  status?: string;
}

export interface AttendanceRecordInput {
  userId: string;
  checkedInAt: string;
  checkedOutAt: string;
  category: AttendanceCategory;
  eventId?: number | null;
  status: MentorStatus;
  reason: string;
}

export type AttendanceRecordUpdate = Partial<Omit<AttendanceRecordInput, 'userId' | 'reason'>> & {
  reason: string;
};

type AttendanceRow = typeof attendance.$inferSelect;

type Snapshot = {
  userId: string | null;
  checkedInAt: string;
  checkedOutAt: string | null;
  category: AttendanceCategory;
  eventId: number | null;
  status: AttendanceStatus;
};

const recordColumns = {
  id: attendance.id,
  userId: attendance.user_id,
  memberName: user.name,
  memberImage: user.image,
  eventId: attendance.event_id,
  eventName: events.name,
  category: attendance.category,
  status: attendance.status,
  checkedInAt: attendance.checked_in_at,
  checkedOutAt: attendance.checked_out_at,
  edited: sql<boolean>`exists (select 1 from ${attendanceAudit} where ${attendanceAudit.attendance_id} = ${attendance.id} and ${attendanceAudit.action} = 'record_updated')`,
};

type RecordRow = {
  id: number;
  userId: string | null;
  memberName: string | null;
  memberImage: string | null;
  eventId: number | null;
  eventName: string | null;
  category: AttendanceCategory;
  status: AttendanceStatus;
  checkedInAt: Date;
  checkedOutAt: Date | null;
  edited: boolean;
};

function hoursFor(checkedInAt: Date, checkedOutAt: Date | null): number {
  if (!checkedOutAt) return 0;
  const hours = (checkedOutAt.getTime() - checkedInAt.getTime()) / 3_600_000;
  return Math.max(0, Math.round(hours * 100) / 100);
}

function toRecord(row: RecordRow) {
  return {
    ...row,
    edited: Boolean(row.edited),
    hours: hoursFor(row.checkedInAt, row.checkedOutAt),
  };
}

function snapshot(row: AttendanceRow): Snapshot {
  return {
    userId: row.user_id,
    checkedInAt: row.checked_in_at.toISOString(),
    checkedOutAt: row.checked_out_at?.toISOString() ?? null,
    category: row.category,
    eventId: row.event_id,
    status: row.status,
  };
}

@Injectable()
export class AttendanceRecordsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly authorization: SeasonAuthorizationService,
  ) {}

  async list(actorId: string, filter: AttendanceRecordFilter = {}) {
    await this.requireAttendanceManager(actorId);
    const search = this.optionalSearch(filter.q);
    const from = filter.from ? this.timestamp(filter.from, 'From') : undefined;
    const to = filter.to ? this.timestamp(filter.to, 'To') : undefined;
    if (from && to && to < from) throw new BadRequestException('To must be on or after From');
    const status = filter.status ? this.status(filter.status, true) : undefined;

    const rows = await this.database.db
      .select(recordColumns)
      .from(attendance)
      .leftJoin(user, eq(attendance.user_id, user.id))
      .leftJoin(events, eq(attendance.event_id, events.id))
      .where(
        and(
          search ? ilike(user.name, `%${search.replace(/[\\%_]/g, '\\$&')}%`) : undefined,
          from ? gte(attendance.checked_in_at, from) : undefined,
          to ? lte(attendance.checked_in_at, to) : undefined,
          status ? eq(attendance.status, status) : undefined,
        ),
      )
      .orderBy(desc(attendance.checked_in_at), desc(attendance.id))
      .limit(RECORD_LIST_LIMIT + 1);

    return {
      records: rows.slice(0, RECORD_LIST_LIMIT).map(toRecord),
      truncated: rows.length > RECORD_LIST_LIMIT,
    };
  }

  async create(actorId: string, input: AttendanceRecordInput) {
    await this.requireAttendanceManager(actorId);
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Attendance details are required');
    }
    const userId = this.requiredText(input.userId, 'Member');
    const checkedInAt = this.timestamp(input.checkedInAt, 'Start time');
    const checkedOutAt = this.timestamp(input.checkedOutAt, 'End time');
    this.requireOrder(checkedInAt, checkedOutAt);
    const category = this.category(input.category);
    const eventId = this.optionalEventId(input.eventId);
    const status = this.status(input.status, false);
    const reason = this.reason(input.reason);

    const id = await this.database.db.transaction(async (tx) => {
      const [member] = await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
      if (!member) throw new NotFoundException('Member not found');
      if (eventId !== null) await this.requireEvent(tx, eventId);

      const [created] = await tx
        .insert(attendance)
        .values({
          user_id: userId,
          checked_in_at: checkedInAt,
          checked_out_at: checkedOutAt,
          category,
          event_id: eventId,
          status,
        })
        .returning();
      if (!created) throw new Error('Attendance insert did not return a row');

      await tx.insert(attendanceAudit).values({
        attendance_id: created.id,
        actor_user_id: actorId,
        subject_user_id: userId,
        action: 'record_created',
        before: null,
        after: snapshot(created),
        reason,
      });
      return created.id;
    });
    return this.findById(id);
  }

  async update(actorId: string, id: number, input: AttendanceRecordUpdate) {
    await this.requireAttendanceManager(actorId);
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Attendance changes are required');
    }
    const reason = this.reason(input.reason);

    await this.database.db.transaction(async (tx) => {
      const [before] = await tx.select().from(attendance).where(eq(attendance.id, id)).limit(1);
      if (!before) throw new NotFoundException('Attendance record not found');

      const changes: Partial<typeof attendance.$inferInsert> = {};
      if (input.checkedInAt !== undefined) {
        changes.checked_in_at = this.timestamp(input.checkedInAt, 'Start time');
      }
      if (input.checkedOutAt !== undefined) {
        changes.checked_out_at = this.timestamp(input.checkedOutAt, 'End time');
      }
      this.requireOrder(
        changes.checked_in_at ?? before.checked_in_at,
        changes.checked_out_at ?? before.checked_out_at,
      );
      if (input.category !== undefined) changes.category = this.category(input.category);
      if (input.status !== undefined) changes.status = this.status(input.status, false);
      if (input.eventId !== undefined) {
        changes.event_id = this.optionalEventId(input.eventId);
        if (changes.event_id !== null) await this.requireEvent(tx, changes.event_id);
      }
      if (Object.keys(changes).length === 0) {
        throw new BadRequestException('Attendance changes are required');
      }

      const [after] = await tx
        .update(attendance)
        .set(changes)
        .where(eq(attendance.id, id))
        .returning();
      if (!after) throw new NotFoundException('Attendance record not found');

      await tx.insert(attendanceAudit).values({
        attendance_id: id,
        actor_user_id: actorId,
        subject_user_id: before.user_id,
        action: 'record_updated',
        before: snapshot(before),
        after: snapshot(after),
        reason,
      });
    });
    return this.findById(id);
  }

  async history(actorId: string, id: number) {
    await this.requireAttendanceManager(actorId);
    const [record] = await this.database.db
      .select({ id: attendance.id })
      .from(attendance)
      .where(eq(attendance.id, id))
      .limit(1);
    if (!record) throw new NotFoundException('Attendance record not found');

    return this.database.db
      .select({
        id: attendanceAudit.id,
        action: attendanceAudit.action,
        actorName: user.name,
        before: attendanceAudit.before,
        after: attendanceAudit.after,
        reason: attendanceAudit.reason,
        createdAt: attendanceAudit.created_at,
      })
      .from(attendanceAudit)
      .leftJoin(user, eq(attendanceAudit.actor_user_id, user.id))
      .where(eq(attendanceAudit.attendance_id, id))
      .orderBy(asc(attendanceAudit.created_at), asc(attendanceAudit.id));
  }

  private async requireAttendanceManager(userId: string): Promise<void> {
    if (!(await this.authorization.canManageAttendance(userId))) {
      throw new ForbiddenException('Only active mentors and Team Admins can manage attendance');
    }
  }

  private async findById(id: number) {
    const [row] = await this.database.db
      .select(recordColumns)
      .from(attendance)
      .leftJoin(user, eq(attendance.user_id, user.id))
      .leftJoin(events, eq(attendance.event_id, events.id))
      .where(eq(attendance.id, id))
      .limit(1);
    if (!row) throw new NotFoundException('Attendance record not found');
    return toRecord(row);
  }

  private async requireEvent(
    tx: Pick<DatabaseService['db'], 'select'>,
    eventId: number,
  ): Promise<void> {
    const [event] = await tx
      .select({ id: events.id })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);
    if (!event) throw new NotFoundException('Event not found');
  }

  private requireOrder(checkedInAt: Date, checkedOutAt: Date | null): void {
    if (checkedOutAt && checkedOutAt <= checkedInAt) {
      throw new BadRequestException('End time must be after start time');
    }
  }

  private status(value: unknown, allowNormal: boolean): AttendanceStatus {
    const allowed = allowNormal
      ? attendanceStatus.enumValues
      : attendanceStatus.enumValues.filter((status) => status !== 'normal');
    if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
      throw new BadRequestException(
        allowNormal ? 'Choose a valid status' : 'Status must be manual or excused',
      );
    }
    return value as AttendanceStatus;
  }

  private category(value: unknown): AttendanceCategory {
    if (
      typeof value !== 'string' ||
      !(eventCategory.enumValues as readonly string[]).includes(value)
    ) {
      throw new BadRequestException('Choose a valid category');
    }
    return value as AttendanceCategory;
  }

  private optionalEventId(value: unknown): number | null {
    if (value == null) return null;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
      throw new BadRequestException('Choose a valid event');
    }
    return value;
  }

  private reason(value: unknown): string {
    const reason = this.requiredText(value, 'Reason');
    if (reason.length > REASON_MAX_LENGTH) {
      throw new BadRequestException(`Reason must be ${REASON_MAX_LENGTH} characters or fewer`);
    }
    return reason;
  }

  private optionalSearch(value: unknown): string | undefined {
    if (value == null) return undefined;
    if (typeof value !== 'string') throw new BadRequestException('Search must be text');
    return value.trim().slice(0, SEARCH_MAX_LENGTH) || undefined;
  }

  private requiredText(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${field} is required`);
    }
    return value.trim();
  }

  private timestamp(value: unknown, field: string): Date {
    if (typeof value !== 'string') throw new BadRequestException(`${field} is required`);
    const timestamp = new Date(value);
    if (Number.isNaN(timestamp.getTime())) {
      throw new BadRequestException(`${field} must be a valid timestamp`);
    }
    return timestamp;
  }
}
