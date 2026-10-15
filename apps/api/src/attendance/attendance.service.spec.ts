
import { Test, type TestingModule } from "@nestjs/testing";
import { errAsync, okAsync } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AttendanceService } from "./attendance.service.js";
import { AttendanceRepository } from "./attendance.repository.js";
import type { Attendance } from "./attendance.schema.js";
import { getTotalPossibleHoursToDate as calculateTotalPossibleHoursToDate } from "./schedule.util.js";

const mockRepository = {
  getUserIdByDiscordId: vi.fn(),
  getLast: vi.fn(),
  createRecord: vi.fn(),
  updateLast: vi.fn(),
  getCurrentHourRequirements: vi.fn(),
};

const USER_ID = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const DISCORD_ID = "123456789012345678";

const REQUIREMENTS = {
  status: "rookie" as const,
  member: 10,
  leadership: 15,
};

function makeAttendance(overrides: Partial<Attendance> = {}): Attendance {
  return {
    id: 1,
    userId: USER_ID,
    checkedInAt: "2026-10-31T14:00:00.000Z",
    checkedOutAt: null,
    category: "meeting",
    eventId: null,
    ...overrides,
  };
}

describe("AttendanceService", () => {
  let service: AttendanceService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: AttendanceRepository, useValue: mockRepository },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);

    mockRepository.getUserIdByDiscordId.mockReturnValue(okAsync(USER_ID));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("recordAttendance", () => {
    it("creates a record when the user has no open session", async () => {
      mockRepository.getLast.mockReturnValue(okAsync(null));
      mockRepository.createRecord.mockReturnValue(okAsync(makeAttendance()));

      const result = await service.recordAttendance(DISCORD_ID, "meeting", null);

      expect(result.isOk()).toBe(true);
      expect(mockRepository.createRecord).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER_ID, category: "meeting" }),
      );
    });

    it("errors when the user already has a recent open session", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-31T15:00:00Z"));

      mockRepository.getLast.mockReturnValue(
        okAsync(
          makeAttendance({
            checkedInAt: "2026-10-31T14:00:00.000Z",
            checkedOutAt: null,
          }),
        ),
      );

      const result = await service.recordAttendance(DISCORD_ID, "meeting", null);

      expect(result.isErr()).toBe(true);
      expect(mockRepository.createRecord).not.toHaveBeenCalled();
    });

    it("credits a stale open session and signs the user in", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));

      const staleSession = makeAttendance({
        checkedInAt: "2026-10-31T14:00:00.000Z",
        checkedOutAt: null,
      });

      mockRepository.getLast.mockReturnValue(okAsync(staleSession));
      mockRepository.updateLast.mockReturnValue(
        okAsync(makeAttendance({ checkedOutAt: "2026-10-31T15:30:00.000Z" })),
      );
      mockRepository.createRecord.mockReturnValue(okAsync(makeAttendance()));

      const result = await service.recordAttendance(DISCORD_ID, "meeting", null);

      expect(result.isOk()).toBe(true);
      expect(mockRepository.updateLast).toHaveBeenCalled();
      expect(mockRepository.createRecord).toHaveBeenCalled();
    });
  });

  describe("updateAttendance", () => {
    it("errors when the user has never signed in", async () => {
      mockRepository.getLast.mockReturnValue(okAsync(null));

      const result = await service.updateAttendance(DISCORD_ID, {
        checkedOutAt: new Date(),
      });

      expect(result.isErr()).toBe(true);
    });

    it("errors when the user is already signed out", async () => {
      mockRepository.getLast.mockReturnValue(
        okAsync(makeAttendance({ checkedOutAt: "2026-10-31T17:00:00.000Z" })),
      );

      const result = await service.updateAttendance(DISCORD_ID, {
        checkedOutAt: new Date(),
      });

      expect(result.isErr()).toBe(true);
    });

    it("signs the user out successfully", async () => {
      mockRepository.getLast.mockReturnValue(
        okAsync(makeAttendance({ checkedOutAt: null })),
      );
      mockRepository.updateLast.mockReturnValue(
        okAsync(makeAttendance({ checkedOutAt: "2026-10-31T17:00:00.000Z" })),
      );

      const result = await service.updateAttendance(DISCORD_ID, {
        checkedOutAt: new Date(),
      });

      expect(result.isOk()).toBe(true);
      expect(mockRepository.updateLast).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ checkedOutAt: expect.any(Date) }),
      );
    });

    it("updates fields directly without the signed-out check when checkedOutAt is omitted", async () => {
      mockRepository.updateLast.mockReturnValue(
        okAsync(makeAttendance({ category: "outreach" })),
      );

      const result = await service.updateAttendance(DISCORD_ID, {
        category: "outreach",
      });

      expect(result.isOk()).toBe(true);
      expect(mockRepository.getLast).not.toHaveBeenCalled();
      expect(mockRepository.updateLast).toHaveBeenCalledWith(USER_ID, {
        category: "outreach",
      });
    });
  });

  describe("handleForgotToSignOut", () => {
    it("credits a stale session with a default duration", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));

      const staleSession = makeAttendance({
        checkedInAt: "2026-10-31T14:00:00.000Z",
        checkedOutAt: null,
      });

      mockRepository.getLast.mockReturnValue(okAsync(staleSession));
      mockRepository.updateLast.mockReturnValue(
        okAsync(makeAttendance({ checkedOutAt: "2026-10-31T15:30:00.000Z" })),
      );

      const result = await service.handleForgotToSignOut(DISCORD_ID);

      expect(result.isOk()).toBe(true);
      expect(mockRepository.updateLast).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ checkedOutAt: expect.any(Date) }),
      );
    });

    it("does not change a non-stale session", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-31T15:00:00Z"));

      const recentSession = makeAttendance({
        checkedInAt: "2026-10-31T14:00:00.000Z",
        checkedOutAt: null,
      });

      mockRepository.getLast.mockReturnValue(okAsync(recentSession));

      const result = await service.handleForgotToSignOut(DISCORD_ID);

      expect(result.isOk()).toBe(true);
      expect(mockRepository.updateLast).not.toHaveBeenCalled();
    });
  });

  describe("getTotalPossibleHoursToDate", () => {
    it("returns the schedule utility's result for an explicit date", () => {
      const asOfDate = new Date("2026-01-15T12:00:00Z");

      const expected = calculateTotalPossibleHoursToDate(asOfDate);
      const actual = service.getTotalPossibleHoursToDate(asOfDate);

      expect(actual).toBe(expected);
      expect(typeof actual).toBe("number");
    });

    it("uses the provided date rather than the current system date", () => {
      const earlyDate = new Date("2025-08-04T12:00:00Z");
      const meetingDate = new Date("2025-08-05T12:00:00Z");

      const earlyTotal = service.getTotalPossibleHoursToDate(earlyDate);
      const meetingTotal = service.getTotalPossibleHoursToDate(meetingDate);

      expect(meetingTotal - earlyTotal).toBe(3);
    });

    it("supports calling the method without an argument", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-09-01T12:00:00Z"));

      expect(() => service.getTotalPossibleHoursToDate()).not.toThrow();

      expect(service.getTotalPossibleHoursToDate()).toBe(
        calculateTotalPossibleHoursToDate(
          new Date("2025-09-01T12:00:00Z"),
        ),
      );
    });
  });

  describe("getCurrentHourRequirements", () => {
    it("delegates to the repository with the Discord ID and supplied date", async () => {
      const asOfDate = new Date("2026-10-31T12:00:00.000Z");

      mockRepository.getCurrentHourRequirements.mockReturnValue(
        okAsync(REQUIREMENTS),
      );

      const result = await service.getCurrentHourRequirements(
        DISCORD_ID,
        asOfDate,
      );

      expect(mockRepository.getCurrentHourRequirements).toHaveBeenCalledWith(
        DISCORD_ID,
        asOfDate,
      );
      expect(result.isOk()).toBe(true);

      if (result.isOk()) {
        expect(result.value).toEqual(REQUIREMENTS);
      }
    });

    it("supplies a current Date when no date is passed", async () => {
      const before = Date.now();

      mockRepository.getCurrentHourRequirements.mockReturnValue(
        okAsync(REQUIREMENTS),
      );

      const result = await service.getCurrentHourRequirements(DISCORD_ID);
      const after = Date.now();

      expect(result.isOk()).toBe(true);
      expect(mockRepository.getCurrentHourRequirements).toHaveBeenCalledWith(
        DISCORD_ID,
        expect.any(Date),
      );

      const passedDate =
        mockRepository.getCurrentHourRequirements.mock.calls[0][1];

      expect(passedDate).toBeInstanceOf(Date);
      expect(passedDate.getTime()).toBeGreaterThanOrEqual(before);
      expect(passedDate.getTime()).toBeLessThanOrEqual(after);
    });

    it("propagates repository errors unchanged", async () => {
      const error = new Error("No active season membership");

      mockRepository.getCurrentHourRequirements.mockReturnValue(errAsync(error));

      const result = await service.getCurrentHourRequirements(DISCORD_ID);

      expect(result.isErr()).toBe(true);

      if (result.isErr()) {
        expect(result.error).toBe(error);
      }
    });
  });
});
