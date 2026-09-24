import { Injectable, Logger } from "@nestjs/common";
import {
  errAsync,
  type ResultAsync,
} from "neverthrow";
import {
  TEAM_NAMES,
} from "./attendance.constants.js";
import { AttendanceRepository } from "./attendance.repository.js";

type AttendanceOperationResult =
  | {
      success: true;
      message?: string;
    }
  | {
      success: false;
      message: string;
    };

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  private readonly ServerId: string;
  private readonly devGuildId: string;

  constructor(private readonly attendanceRepository: AttendanceRepository,) {
    this.ServerId = process.env.DISCORD_GUILD_ID || "";
    this.devGuildId = process.env.DISCORD_DEVELOPMENT_GUILD_ID || "";
  }

  private getTeam(guildId: string) {
    switch (guildId) {
      case this.ServerId:
        return TEAM_NAMES.OFFICIAL_NAME;
      case this.devGuildId:
        return TEAM_NAMES.DEV;
      default:
        return "";
    }
  }

  public recordAttendance(
  id: number,
  userId: string,
  category: "meeting" | "outreach",
  eventId: number,
  checkedInAt: Date = new Date(),
): ResultAsync<void, Error> {
  return this.attendanceRepository.getLast(userId).andThen((attendance) => {
    if (attendance && attendance.checkedOutAt === null) {
      return errAsync(new Error("User is already checked in"));
    }

    return this.attendanceRepository
      .createRecord({
        userId,
        checkedInAt,
        category,
        eventId,
      })
      .map(() => undefined);
  });
}
}