import { Injectable, Logger } from "@nestjs/common";
import {
  errAsync,
  type ResultAsync,
} from "neverthrow";
import { AttendanceRepository } from "./attendance.repository.js";
import {type AttendanceUpdate} from "./attendance.repository.js";

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(private readonly attendanceRepository: AttendanceRepository,) {}  

  public recordAttendance(
  discordId: string,
  category: "meeting" | "outreach",
  eventId: number | null,
  checkedInAt: Date = new Date(),
): ResultAsync<void, Error> {
  return this.attendanceRepository.getUserIdByDiscordId(discordId).andThen((userId) => {
    return this.attendanceRepository.getLast(userId).andThen((attendance) => {
      if (attendance && attendance.checkedOutAt === null) {
        return errAsync(new Error("User is already signed in"));
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
  });
}

  public updateAttendance(
    discordId: string,
    updates: AttendanceUpdate
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
}