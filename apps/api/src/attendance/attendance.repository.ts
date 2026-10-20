import { Injectable, Logger } from "@nestjs/common";
import { and, desc, eq, gt, gte, isNull, lte, or, sql } from "drizzle-orm";
import { err, ok, Result, ResultAsync } from "neverthrow";

import { DatabaseService } from "../database/database.service.js";
import {
  account,
  attendance,
  hour_requirements,
  season_memberships,
  seasons,
} from "../database/schema/index.js";
import { type Attendance, AttendanceSchema } from "./attendance.schema.js";

export type AttendanceCreate = {
  userId: string;
  checkedInAt: Date;
  category: "meeting" | "outreach";
  eventId: number | null;
};

export type AttendanceUpdate = {
  checkedInAt?: Date;
  checkedOutAt?: Date | null;
  category?: "meeting" | "outreach";
  eventId?: number | null;
};

export type AttendanceSumFilter = {
  category?: "meeting" | "outreach";
  eventId?: number | null;
  checkedInFrom?: Date;
  checkedInThrough?: Date;
};

export type AttendanceRequirementSummary = {
  status: typeof hour_requirements.$inferSelect.status;
  member: number;
  leadership: number;
};

type MembershipRequirementFields = Pick<
  typeof season_memberships.$inferSelect,
  "role" | "student_experience" | "legacy_status"
>;

export function getRequirementStatus(
  membership: MembershipRequirementFields,
): AttendanceRequirementSummary["status"] | null {
  if (membership.legacy_status) {
    return membership.legacy_status;
  }

  if (membership.role === "mentor" || membership.role === "team_admin") {
    return "mentor";
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

  getSum(
    userId: string,
    filter?: AttendanceSumFilter,
  ): ResultAsync<number, Error> {
    return ResultAsync.fromPromise(
      this.database.db
        .select({
          totalSeconds: sql<number>`COALESCE(
            SUM(
              EXTRACT(
                EPOCH FROM (
                  ${attendance.checked_out_at} -
                  ${attendance.checked_in_at}
                )
              )
            ),
            0
          )`,
        })
        .from(attendance)
        .where(
          and(
            eq(attendance.user_id, userId),
            filter?.category !== undefined
              ? eq(attendance.category, filter.category)
              : undefined,
            filter?.eventId !== undefined
              ? filter.eventId === null
                ? isNull(attendance.event_id)
                : eq(attendance.event_id, filter.eventId)
              : undefined,
            filter?.checkedInFrom !== undefined
              ? gte(attendance.checked_in_at, filter.checkedInFrom)
              : undefined,
            filter?.checkedInThrough !== undefined
              ? lte(attendance.checked_in_at, filter.checkedInThrough)
              : undefined,
          ),
        ),
      (error) => (error instanceof Error ? error : new Error(String(error))),
    ).andThen((result) => {
      const totalSeconds = Number(result[0]?.totalSeconds ?? 0);
      const hours = Math.round((totalSeconds / 3600) * 100) / 100;

      return ok(hours);
    });
  }

  /**
   * Retrieves the active season's meeting requirements for the user's status.
   */
  getCurrentHourRequirements(
    discordId: string,
    asOfDate: Date = new Date(),
  ): ResultAsync<AttendanceRequirementSummary, Error> {
    return this.getUserIdByDiscordId(discordId).andThen((userId) =>
      ResultAsync.fromPromise(
        this.database.db
          .select({
            seasonId: seasons.id,
            role: season_memberships.role,
            student_experience: season_memberships.student_experience,
            legacy_status: season_memberships.legacy_status,
          })
          .from(season_memberships)
          .innerJoin(seasons, eq(season_memberships.season_id, seasons.id))
          .where(
            and(
              eq(season_memberships.user_id, userId),
              eq(season_memberships.state, "active"),
              lte(seasons.started_at, asOfDate),
              gte(seasons.ended_at, asOfDate),
              lte(season_memberships.started_at, asOfDate),
              or(
                isNull(season_memberships.ended_at),
                gte(season_memberships.ended_at, asOfDate),
              ),
              lte(season_memberships.joined_at, asOfDate),
              or(
                isNull(season_memberships.removed_at),
                gt(season_memberships.removed_at, asOfDate),
              ),
            ),
          )
          .orderBy(desc(seasons.started_at))
          .limit(1),
        (error) => (error instanceof Error ? error : new Error(String(error))),
      ).andThen((memberships) => {
        const membership = memberships[0];

        if (!membership) {
          return err(new Error("No active season membership found"));
        }

        const status = getRequirementStatus(membership);

        if (!status) {
          return err(
            new Error(
              `No attendance requirement status is configured for membership role "${membership.role}"`,
            ),
          );
        }

        return ResultAsync.fromPromise(
          this.database.db
            .select({
              isLeader: hour_requirements.is_leader,
              requiredHours: hour_requirements.required_hours,
            })
            .from(hour_requirements)
            .where(
              and(
                eq(hour_requirements.status, status),
                eq(hour_requirements.season_id, membership.seasonId),
                eq(hour_requirements.category, "meeting"),
              ),
            ),
          (error) => (error instanceof Error ? error : new Error(String(error))),
        ).andThen((rows) => {
          const memberRequirement = rows.find((row) => !row.isLeader);
          const leadershipRequirement = rows.find((row) => row.isLeader);

          if (!memberRequirement || !leadershipRequirement) {
            return err(
              new Error(
                `Meeting requirements are not configured for status "${status}" in season ${membership.seasonId}`,
              ),
            );
          }

          return ok({
            status,
            member: memberRequirement.requiredHours,
            leadership: leadershipRequirement.requiredHours,
          });
        });
      }),
    );
  }

  ensureCurrentSeasonMembership(
    discordId: string,
    asOfDate: Date = new Date(),
  ): ResultAsync<string, Error> {
    return this.getUserIdByDiscordId(discordId).andThen((userId) =>
      ResultAsync.fromPromise(
        this.database.db.transaction(async (tx) => {
          const [activeSeason] = await tx
            .select({ id: seasons.id })
            .from(seasons)
            .where(
              and(
                lte(seasons.started_at, asOfDate),
                gte(seasons.ended_at, asOfDate),
              ),
            )
            .orderBy(desc(seasons.started_at))
            .limit(1);

          if (!activeSeason) {
            throw new Error("No active season found");
          }

          const [currentMembership] = await tx
            .select({
              id: season_memberships.id,
              state: season_memberships.state,
            })
            .from(season_memberships)
            .where(
              and(
                eq(season_memberships.user_id, userId),
                eq(season_memberships.season_id, activeSeason.id),
              ),
            )
            .limit(1);

          if (currentMembership) {
            if (currentMembership.state !== "active") {
              throw new Error("Season membership is removed");
            }

            return userId;
          }

          const [previousMembership] = await tx
            .select({ id: season_memberships.id })
            .from(season_memberships)
            .where(eq(season_memberships.user_id, userId))
            .limit(1);

          await tx
            .insert(season_memberships)
            .values({
              season_id: activeSeason.id,
              user_id: userId,
              role: "student",
              student_experience: previousMembership ? "veteran" : "rookie",
            })
            .onConflictDoNothing({
              target: [
                season_memberships.user_id,
                season_memberships.season_id,
              ],
            });

          return userId;
        }),
        (error) => (error instanceof Error ? error : new Error(String(error))),
      ),
    );
  }

  createRecord(
    record: AttendanceCreate,
  ): ResultAsync<Attendance, Error> {
    return ResultAsync.fromPromise<(typeof attendance.$inferSelect)[], Error>(
      this.database.db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtextextended(${record.userId}, 0))`,
        );

        const [last] = await tx
          .select({ checked_out_at: attendance.checked_out_at })
          .from(attendance)
          .where(eq(attendance.user_id, record.userId))
          .orderBy(desc(attendance.checked_in_at))
          .limit(1);

        if (last && last.checked_out_at === null) {
          throw new Error("User is already signed in");
        }

        return tx
          .insert(attendance)
          .values({
            user_id: record.userId,
            checked_in_at: record.checkedInAt,
            checked_out_at: null,
            category: record.category,
            event_id: record.eventId,
          })
          .returning();
      }),
      (error) => (error instanceof Error ? error : new Error(String(error))),
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
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`,
        );

        const [last] = await tx
          .select({ id: attendance.id })
          .from(attendance)
          .where(eq(attendance.user_id, userId))
          .orderBy(desc(attendance.checked_in_at))
          .limit(1);

        if (!last) {
          throw new Error("No attendance record found to update");
        }

        const condition =
          updates.checkedOutAt != null
            ? and(eq(attendance.id, last.id), isNull(attendance.checked_out_at))
            : eq(attendance.id, last.id);

        return tx
          .update(attendance)
          .set(setObject)
          .where(condition)
          .returning();
      }),
      (error) => (error instanceof Error ? error : new Error(String(error))),
    ).andThen((result) =>
      this.parseRow(result[0]).andThen((row) =>
        row ? ok(row) : err(new Error("Attendance record was not updated")),
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
      checkedOutAt: row.checked_out_at
        ? row.checked_out_at.toISOString()
        : null,
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
        .where(
          and(
            eq(account.accountId, discordId),
            eq(account.providerId, "discord"),
          ),
        )
        .limit(1),
      (error) => (error instanceof Error ? error : new Error(String(error))),
    ).andThen((result) => {
      if (!result.length) {
        return err(new Error("User not found"));
      }

      return ok(result[0].userId);
    });
  }
}