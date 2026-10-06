import { Injectable, Logger } from "@nestjs/common";
import {
  errAsync,
  type ResultAsync,
  err,
  ok,
  fromThrowable,
  type Result,
  okAsync,
} from "neverthrow";
import { AttendanceRepository } from "./attendance.repository.js";
import { type AttendanceUpdate } from "./attendance.repository.js";
import { Attendance } from "./attendance.schema.js";
import { FORGOT_SIGNOUT_CREDIT_MS, STALE_SIGNIN_MIN_HOURS_MS } from "./attendance.constants.js";

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(private readonly attendanceRepository: AttendanceRepository) {}

  public recordAttendance(
    discordId: string,
    category: "meeting" | "outreach",
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
            return errAsync(new Error("User is already signed in"));
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

  public updateAttendance(
    discordId: string,
    updates: AttendanceUpdate,
  ): ResultAsync<void, Error> {
    return this.attendanceRepository.getUserIdByDiscordId(discordId).andThen((userId) => {
      return this.attendanceRepository.getLast(userId).andThen((attendance) => {
        if (!attendance) {
          return errAsync(new Error("User was not signed out because they have not signed in yet"));
        }

        if (attendance.checkedOutAt !== null) {
          return errAsync(new Error("User is already signed out"));
        }

        return this.attendanceRepository
          .updateLast(userId, {
            checkedOutAt: updates.checkedOutAt || new Date(),
          })
          .map(() => undefined);
      });
    });
  }

  private isStaleSession(signInTime: Date): Result<boolean, Error> {
    const toEasternYMD = fromThrowable(
      (date: Date) => {
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: "America/New_York",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).formatToParts(date);
        const getPart = (type: "year" | "month" | "day") => {
          const part = parts.find((p) => p.type === type);
          if (part == null) throw new Error(`Missing ${type} in date parts`);
          return Number(part.value);
        };
        return { year: getPart("year"), month: getPart("month"), day: getPart("day") };
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
          return errAsync(new Error("No attendance record found for user"));
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
              return errAsync(new Error("Failed to credit forgotten sign-out"));
            }
            return okAsync(updated);
          });
      });
    });
  }
}