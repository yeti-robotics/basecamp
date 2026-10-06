import { Test, type TestingModule } from "@nestjs/testing";
import { okAsync } from "neverthrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AttendanceService } from "./attendance.service.js";
import { AttendanceRepository } from "./attendance.repository.js";
import type { Attendance } from "./attendance.schema.js";

const mockRepository = {
  getUserIdByDiscordId: vi.fn(),
  getLast: vi.fn(),
  createRecord: vi.fn(),
  updateLast: vi.fn(),
};

const USER_ID = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const DISCORD_ID = "123456789012345678";

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
      vi.setSystemTime(new Date("2026-10-31T15:00:00Z")); //not stale

      mockRepository.getLast.mockReturnValue(
        okAsync(makeAttendance({ checkedInAt: "2026-10-31T14:00:00.000Z", checkedOutAt: null })),
      );

      const result = await service.recordAttendance(DISCORD_ID, "meeting", null);

      expect(result.isErr()).toBe(true);
      expect(mockRepository.createRecord).not.toHaveBeenCalled();
    });

    it("credits a stale open session and signs the user in", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));

      const staleSession = makeAttendance({ checkedInAt: "2026-10-31T14:00:00.000Z", checkedOutAt: null });
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

      const result = await service.updateAttendance(DISCORD_ID, {});

      expect(result.isErr()).toBe(true);
    });

    it("errors when the user is already signed out", async () => {
      mockRepository.getLast.mockReturnValue(
        okAsync(makeAttendance({ checkedOutAt: "2026-10-31T17:00:00.000Z" })),
      );

      const result = await service.updateAttendance(DISCORD_ID, {});

      expect(result.isErr()).toBe(true);
    });

    it("signs the user out successfully", async () => {
      mockRepository.getLast.mockReturnValue(okAsync(makeAttendance({ checkedOutAt: null })));
      mockRepository.updateLast.mockReturnValue(
        okAsync(makeAttendance({ checkedOutAt: "2026-10-31T17:00:00.000Z" })),
      );

      const result = await service.updateAttendance(DISCORD_ID, {});

      expect(result.isOk()).toBe(true);
      expect(mockRepository.updateLast).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ checkedOutAt: expect.any(Date) }),
      );
    });
  });

  describe("handleForgotToSignOut", () => {
    it("credits a stale session with a default duration", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));

      const staleSession = makeAttendance({ checkedInAt: "2026-10-31T14:00:00.000Z", checkedOutAt: null });
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
      vi.setSystemTime(new Date("2026-10-31T15:00:00Z")); //not stale

      const recentSession = makeAttendance({ checkedInAt: "2026-10-31T14:00:00.000Z", checkedOutAt: null });
      mockRepository.getLast.mockReturnValue(okAsync(recentSession));

      const result = await service.handleForgotToSignOut(DISCORD_ID);

      expect(result.isOk()).toBe(true);
      expect(mockRepository.updateLast).not.toHaveBeenCalled();
    });
  });
});