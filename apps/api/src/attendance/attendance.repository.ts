import { Injectable, Logger } from "@nestjs/common";
import { err, errAsync, ok, Result, ResultAsync } from "neverthrow";
import { sql, type SQL } from "drizzle-orm";
import type { QueryResult } from "pg";

import { db } from "../auth.js";
import { type Attendance, AttendanceSchema } from "./attendance.schema.js";

type AttendanceCreate = {
  id: number;
  userId: string;
  checkedInAt: Date;
  category: "meeting" | "outreach";
  eventId: number;
};

type AttendanceUpdate = {
  checkedInAt?: Date;
  checkedOutAt?: Date | null;
  category?: "meeting" | "outreach";
  eventId?: number;
};

@Injectable()
export class AttendanceRepository {
  private readonly logger = new Logger(AttendanceRepository.name);

  getLast(userId: string): ResultAsync<Attendance | null, Error> {
    return ResultAsync.fromPromise<QueryResult<Attendance>, Error>(
      db.execute(
        sql`
          SELECT *
          FROM attendance
          WHERE userId = ${userId}
          ORDER BY checkedInAt DESC
          LIMIT 1
        `,
      ),
      (error) =>
        error instanceof Error ? error : new Error(String(error)),
    ).andThen((result) => this.parseRow(result.rows[0]));
  }

  createRecord(
    record: AttendanceCreate,
  ): ResultAsync<Attendance, Error> {
    return ResultAsync.fromPromise<QueryResult<Attendance>, Error>(
      db.execute(sql`
        INSERT INTO attendance (
          id,
          userId,
          checkedInAt,
          checkedOutAt,
          category,
          eventId
        )
        VALUES (
          ${record.id},
          ${record.userId},
          ${record.checkedInAt.toISOString()},
          NULL,
          ${record.category},
          ${record.eventId}
        )
        RETURNING *
      `),
      (error) =>
        error instanceof Error ? error : new Error(String(error)),
    ).andThen((result) =>
      this.parseRow(result.rows[0]).andThen((row) => {
        if (!row) {
          return err(new Error("Attendance record was not created"));
        }

        return ok(row);
      }),
    );
  }

  updateLast(
    userId: string,
    updates: AttendanceUpdate,
  ): ResultAsync<Attendance | null, Error> {
    const setClauses: SQL[] = [];

    if (updates.checkedInAt !== undefined) {
      setClauses.push(
        sql`checkedInAt = ${updates.checkedInAt.toISOString()}`,
      );
    }

    if (updates.checkedOutAt !== undefined) {
      setClauses.push(
        sql`checkedOutAt = ${
          updates.checkedOutAt?.toISOString() ?? null
        }`,
      );
    }

    if (updates.category !== undefined) {
      setClauses.push(sql`category = ${updates.category}`);
    }

    if (updates.eventId !== undefined) {
      setClauses.push(sql`eventId = ${updates.eventId}`);
    }

    if (setClauses.length === 0) {
      return errAsync(
        new Error("No attendance fields provided to update"),
      );
    }

    const setClause = sql.join(setClauses, sql`, `);

    return ResultAsync.fromPromise<QueryResult<Attendance>, Error>(
      db.execute(
        sql`
          UPDATE attendance
          SET ${setClause}
          WHERE id = (
            SELECT id
            FROM attendance
            WHERE userId = ${userId}
            ORDER BY checkedInAt DESC
            LIMIT 1
          )
          RETURNING *
        `,
      ),
      (error) =>
        error instanceof Error ? error : new Error(String(error)),
    ).andThen((result) => this.parseRow(result.rows[0]));
  }

  private parseRow(row: unknown): Result<Attendance | null, Error> {
    if (!row) {
      return ok(null);
    }

    const parsed = AttendanceSchema.safeParse(row);

    if (!parsed.success) {
      this.logger.error(
        `Invalid attendance row: ${parsed.error.message}`,
      );
      return err(parsed.error);
    }

    return ok(parsed.data);
  }
}