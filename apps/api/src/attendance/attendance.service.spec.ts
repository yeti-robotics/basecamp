import { errAsync, okAsync } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttendanceRepository } from "./attendance.repository.js";
import { AttendanceCodeService } from "./attendance-code.service.js";
import { AttendanceService, completedHours } from "./attendance.service.js";

const discordId = "123456789012345678";
const userId = "user-1";

function makeAttendance(
  checkedInAt: Date,
  checkedOutAt: Date | null = null,
) {
  return {
    id: 1,
    userId,
    checkedInAt: checkedInAt.toISOString(),
    checkedOutAt: checkedOutAt?.toISOString() ?? null,
    category: "meeting" as const,
    eventId: null,
  };
}

describe("AttendanceService", () => {
  const repository = {
    ensureCurrentSeasonMembership: vi.fn(),
    getLast: vi.fn(),
    createRecord: vi.fn(),
    getUserIdByDiscordId: vi.fn(),
    updateLast: vi.fn(),
  };

  const codeService = {
    verify: vi.fn(),
  };

  let service: AttendanceService;

  beforeEach(() => {
    vi.clearAllMocks();

    service = new AttendanceService(
      repository as unknown as AttendanceRepository,
      {} as never,
      codeService as unknown as AttendanceCodeService,
    );
  });

  describe("recordAttendance", () => {
    it("creates a record when the user has no open session", async () => {
      const checkedInAt = new Date("2026-10-15T14:00:00Z");

      repository.ensureCurrentSeasonMembership.mockReturnValue(
        okAsync(userId),
      );
      repository.getLast.mockReturnValue(okAsync(null));
      repository.createRecord.mockReturnValue(
        okAsync(makeAttendance(checkedInAt)),
      );

      const result = await service.recordAttendance(
        discordId,
        "meeting",
        null,
        checkedInAt,
      );

      expect(result.isOk()).toBe(true);
      expect(repository.ensureCurrentSeasonMembership).toHaveBeenCalledWith(
        discordId,
        checkedInAt,
      );
      expect(repository.createRecord).toHaveBeenCalledWith({
        userId,
        checkedInAt,
        category: "meeting",
        eventId: null,
      });
    });

    it("errors when the user already has a recent open session", async () => {
      vi.useFakeTimers();

      const checkedInAt = new Date("2026-10-15T14:00:00Z");
      vi.setSystemTime(checkedInAt);

      repository.ensureCurrentSeasonMembership.mockReturnValue(
        okAsync(userId),
      );
      repository.getLast.mockReturnValue(
        okAsync(makeAttendance(new Date("2026-10-15T13:00:00Z"))),
      );

      try {
        const result = await service.recordAttendance(
          discordId,
          "meeting",
          null,
          checkedInAt,
        );

        expect(result.isErr()).toBe(true);
        expect(result._unsafeUnwrapErr().message).toBe(
          "User is already signed in",
        );
        expect(repository.createRecord).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it("credits a stale open session and signs the user in", async () => {
      const checkedInAt = new Date("2026-10-15T14:00:00Z");
      const staleSignIn = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const staleAttendance = makeAttendance(staleSignIn);
      const creditedAttendance = makeAttendance(
        staleSignIn,
        new Date(staleSignIn.getTime() + 90 * 60 * 1000),
      );

      repository.ensureCurrentSeasonMembership.mockReturnValue(
        okAsync(userId),
      );
      repository.getLast
        .mockReturnValueOnce(okAsync(staleAttendance))
        .mockReturnValueOnce(okAsync(staleAttendance));
      repository.getUserIdByDiscordId.mockReturnValue(okAsync(userId));
      repository.updateLast.mockReturnValue(okAsync(creditedAttendance));
      repository.createRecord.mockReturnValue(
        okAsync(makeAttendance(checkedInAt)),
      );

      const result = await service.recordAttendance(
        discordId,
        "meeting",
        null,
        checkedInAt,
      );

      expect(result.isOk()).toBe(true);
      expect(repository.updateLast).toHaveBeenCalledWith(userId, {
        checkedOutAt: new Date(staleSignIn.getTime() + 90 * 60 * 1000),
      });
      expect(repository.createRecord).toHaveBeenCalledWith({
        userId,
        checkedInAt,
        category: "meeting",
        eventId: null,
      });
    });

    it("returns an error when ensuring the season membership fails", async () => {
      repository.ensureCurrentSeasonMembership.mockReturnValue(
        errAsync(new Error("No active season found")),
      );

      const result = await service.recordAttendance(
        discordId,
        "meeting",
        null,
      );

      expect(result.isErr()).toBe(true);
      expect(repository.getLast).not.toHaveBeenCalled();
      expect(repository.createRecord).not.toHaveBeenCalled();
    });
  });

  describe("signInWithCode", () => {
    it("rejects an invalid code without recording attendance", async () => {
      codeService.verify.mockResolvedValue(false);

      const result = await service.signInWithCode(discordId, "bad-code");

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toBe(
        "Invalid attendance code",
      );
      expect(repository.ensureCurrentSeasonMembership).not.toHaveBeenCalled();
    });
  });
});

describe("completedHours", () => {
  const start = new Date("2026-10-15T14:00:00Z");
  const end = new Date("2026-10-15T18:00:00Z");

  it("returns the duration of a completed session", () => {
    expect(
      completedHours(
        {
          id: 1,
          category: "meeting",
          checkedInAt: start,
          checkedOutAt: new Date("2026-10-15T16:30:00Z"),
          name: null,
        },
        start,
        end,
      ),
    ).toBe(2.5);
  });

  it("clips session hours to the requested time range", () => {
    expect(
      completedHours(
        {
          id: 1,
          category: "meeting",
          checkedInAt: new Date("2026-10-15T13:00:00Z"),
          checkedOutAt: new Date("2026-10-15T19:00:00Z"),
          name: null,
        },
        start,
        end,
      ),
    ).toBe(4);
  });

  it("counts no hours for an open session", () => {
    expect(
      completedHours(
        {
          id: 1,
          category: "meeting",
          checkedInAt: start,
          checkedOutAt: null,
          name: null,
        },
        start,
        end,
      ),
    ).toBe(0);
  });
});