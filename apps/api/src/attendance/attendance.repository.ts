import { Injectable, Logger } from "@nestjs/common";
import { err, ok, Result, ResultAsync } from "neverthrow";
import { eq, desc, and } from "drizzle-orm";

import { DatabaseService } from "../database/database.service.js";
import { type Attendance, AttendanceSchema } from "./attendance.schema.js";
import { account, attendance } from "../database/schema/index.js";

type AttendanceCreate = {
  userId: string;
  checkedInAt: Date;
  category: "meeting" | "outreach";
  eventId: number | null;
};

type AttendanceUpdate = {
  checkedInAt?: Date;
  checkedOutAt?: Date | null;
  category?: "meeting" | "outreach";
  eventId?: number | null;
};

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
      (error) =>
        error instanceof Error ? error : new Error(String(error)),
    ).andThen((result) => this.parseRow(result[0]));
  }

  createRecord(
    record: AttendanceCreate,
  ): ResultAsync<Attendance, Error> {
    return ResultAsync.fromPromise<(typeof attendance.$inferSelect)[], Error>(
      this.database.db.insert(attendance).values({
        user_id: record.userId,
        checked_in_at: record.checkedInAt,
        checked_out_at: null,
        category: record.category,
        event_id: record.eventId,
      }).returning(),
      (error) =>
        error instanceof Error ? error : new Error(String(error)),
    ).andThen((rows) =>
  this.parseRow(rows[0]).andThen((row) =>
    row ? ok(row) : err(new Error("Attendance record was not created")),
    ),
  );
  }

  updateLast(
    userId: string,
    updates: AttendanceUpdate,
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
        // Get last record using transaction so update works on correct record
        const [last] = await tx
        .select({id: attendance.id})
        .from(attendance)
        .where(eq(attendance.user_id, userId))
        .orderBy(desc(attendance.checked_in_at))
        .limit(1);

        if (!last) {
          throw new Error("No attendance record found to update");
        }

        return tx.update(attendance)
        .set(setObject)
        .where(eq(attendance.id, last.id))
        .returning();
      }),
      (error) =>
        error instanceof Error ? error : new Error(String(error)),
    ).andThen((result) => this.parseRow(result[0]));
  }

  private parseRow(row: typeof attendance.$inferSelect | undefined): Result<Attendance | null, Error> {
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
      this.logger.error(
        `Invalid attendance row: ${parsed.error.message}`,
      );
      return err(parsed.error);
    }

    return ok(parsed.data);
  }

  getUserIdByDiscordId(discordId: string): ResultAsync<string, Error> {
    return ResultAsync.fromPromise<{ userId: string }[], Error>(
      this.database.db
        .select({ userId: account.userId })
        .from(account)
        .where(and(eq(account.accountId, discordId), eq(account.providerId, "discord")))
        .limit(1),
      (error) =>
        error instanceof Error ? error : new Error(String(error)),
    ).andThen((result) => {
      if (!result.length) {
        return err(new Error("User not found"));
      }
      return ok(result[0].userId);
    });
  }
}