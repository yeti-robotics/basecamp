import { errAsync, okAsync } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccessService } from "../access/access.service.js";
import type { SeasonAuthorizationService } from "../seasons/season-authorization.service.js";
import type { AttendanceRepository } from "./attendance.repository.js";
import { AttendanceCodeService } from "./attendance-code.service.js";
import { AttendanceService, completedHours } from "./attendance.service.js";

const discordId = "123456789012345678";
const targetDiscordId = "987654321098765432";
const userId = "user-1";
const actorUserId = "actor-1";

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

  const access = {
    isSuspended: vi.fn(),
  };

  const seasonAuthorization = {
    canManageAttendance: vi.fn(),
  };

  let service: AttendanceService;

  beforeEach(() => {
    vi.clearAllMocks();
    access.isSuspended.mockResolvedValue(false);
    seasonAuthorization.canManageAttendance.mockResolvedValue(true);

    service = new AttendanceService(
      repository as unknown as AttendanceRepository,
      {} as never,
      codeService as unknown as AttendanceCodeService,
      access as unknown as AccessService,
      seasonAuthorization as unknown as SeasonAuthorizationService,
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

  describe("mentor attendance operations", () => {
    it("allows an active mentor to sign in another member", async () => {
      repository.getUserIdByDiscordId.mockReturnValue(okAsync(actorUserId));
      const recordAttendance = vi
        .spyOn(service, "recordAttendance")
        .mockReturnValue(okAsync(undefined));

      const result = await service.signInForMember(discordId, targetDiscordId);

      expect(result.isOk()).toBe(true);
      expect(repository.getUserIdByDiscordId).toHaveBeenCalledWith(discordId);
      expect(access.isSuspended).toHaveBeenCalledWith(actorUserId);
      expect(seasonAuthorization.canManageAttendance).toHaveBeenCalledWith(
        actorUserId,
      );
      expect(recordAttendance).toHaveBeenCalledWith(
        targetDiscordId,
        "meeting",
        null,
      );
    });

    it("allows an active Team Admin to sign out another member", async () => {
      repository.getUserIdByDiscordId.mockReturnValue(okAsync(actorUserId));
      const updateAttendance = vi
        .spyOn(service, "updateAttendance")
        .mockReturnValue(okAsync(undefined));

      const result = await service.signOutForMember(discordId, targetDiscordId);

      expect(result.isOk()).toBe(true);
      expect(updateAttendance).toHaveBeenCalledWith(
        targetDiscordId,
        expect.objectContaining({ checkedOutAt: expect.any(Date) }),
      );
    });

    it("rejects a user without mentor or Team Admin access", async () => {
      repository.getUserIdByDiscordId.mockReturnValue(okAsync(actorUserId));
      seasonAuthorization.canManageAttendance.mockResolvedValue(false);
      const recordAttendance = vi.spyOn(service, "recordAttendance");

      const result = await service.signInForMember(discordId, targetDiscordId);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toBe(
        "Not authorized to manage attendance",
      );
      expect(recordAttendance).not.toHaveBeenCalled();
    });

    it("rejects a suspended mentor", async () => {
      repository.getUserIdByDiscordId.mockReturnValue(okAsync(actorUserId));
      access.isSuspended.mockResolvedValue(true);
      const recordAttendance = vi.spyOn(service, "recordAttendance");

      const result = await service.signInForMember(discordId, targetDiscordId);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toBe(
        "Not authorized to manage attendance",
      );
      expect(recordAttendance).not.toHaveBeenCalled();
    });
  });

  describe("getOverviewForDiscordUser", () => {
    it("looks up the Basecamp user and returns their season overview", async () => {
      const overview = { season: null, progress: null };
      repository.getUserIdByDiscordId.mockReturnValue(okAsync(userId));
      const spy = vi.spyOn(service, "overview").mockResolvedValue(overview as never);
      const now = new Date("2026-11-09T23:00:00.000Z");

      const result = await service.getOverviewForDiscordUser(discordId, now);

      expect(result._unsafeUnwrap()).toBe(overview);
      expect(repository.getUserIdByDiscordId).toHaveBeenCalledWith(discordId);
      expect(spy).toHaveBeenCalledWith(userId, now);
    });

    it("returns lookup and overview failures as errors", async () => {
      repository.getUserIdByDiscordId.mockReturnValueOnce(
        errAsync(new Error("User not found")),
      );
      expect(
        (await service.getOverviewForDiscordUser(discordId))._unsafeUnwrapErr().message,
      ).toBe("User not found");

      repository.getUserIdByDiscordId.mockReturnValueOnce(okAsync(userId));
      vi.spyOn(service, "overview").mockRejectedValueOnce("database offline");
      expect(
        (await service.getOverviewForDiscordUser(discordId))._unsafeUnwrapErr().message,
      ).toBe("database offline");
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
describe("AttendanceService.overview", () => {
  // Each query resolves to its rows whichever builder method ends the chain.
  function query(rows: unknown[]) {
    const builder = Object.assign(Promise.resolve(rows), {
      from: vi.fn(() => builder),
      leftJoin: vi.fn(() => builder),
      where: vi.fn(() => builder),
      orderBy: vi.fn(() => builder),
      limit: vi.fn(() => builder),
    });
    return builder;
  }

  const db = { select: vi.fn() };
  const now = new Date("2026-11-09T23:00:00.000Z");
  const season = {
    id: 1,
    name: "2026–27",
    started_at: new Date("2026-05-15T04:00:00.000Z"),
    ended_at: new Date("2027-05-15T03:59:59.000Z"),
  };
  const membership = {
    role: "student",
    student_experience: "rookie",
    legacy_status: null,
  };
  const requirementRows = [
    { category: "meeting", is_leader: false, required_hours: 26 },
    { category: "meeting", is_leader: true, required_hours: 39 },
    { category: "outreach", is_leader: false, required_hours: 5 },
  ];
  const meetings = [
    {
      id: 1,
      startsAt: new Date("2026-11-03T21:30:00.000Z"),
      endsAt: new Date("2026-11-04T00:30:00.000Z"),
    },
    {
      id: 2,
      startsAt: new Date("2026-11-07T14:00:00.000Z"),
      endsAt: new Date("2026-11-07T18:00:00.000Z"),
    },
    {
      id: 3,
      startsAt: new Date("2026-11-10T21:30:00.000Z"),
      endsAt: new Date("2026-11-11T00:30:00.000Z"),
    },
  ];
  const records = [
    {
      id: 11,
      category: "meeting",
      status: "excused",
      eventId: 2,
      name: "Saturday build",
      checkedInAt: new Date("2026-11-07T14:00:00.000Z"),
      checkedOutAt: new Date("2026-11-07T18:00:00.000Z"),
    },
    {
      id: 10,
      category: "outreach",
      status: "normal",
      eventId: null,
      name: null,
      checkedInAt: new Date("2026-11-01T16:00:00.000Z"),
      checkedOutAt: new Date("2026-11-01T18:00:00.000Z"),
    },
  ];

  function makeService() {
    return new AttendanceService(
      {} as never,
      { db } as never,
      {} as never,
      {} as never,
      {} as never,
    );
  }

  function mockQueries(memberships: unknown[], requirements = requirementRows) {
    db.select
      .mockReturnValueOnce(query([season]))
      .mockReturnValueOnce(query(records))
      .mockReturnValueOnce(query(memberships))
      .mockReturnValueOnce(query(meetings))
      .mockReturnValueOnce(query(requirements));
  }

  beforeEach(() => {
    db.select.mockReset();
  });

  it("returns empty progress when no season is active", async () => {
    db.select.mockReturnValueOnce(query([]));

    await expect(makeService().overview("user-1", now)).resolves.toEqual({
      season: null,
      hours: { meeting: 0, outreach: 0, total: 0 },
      requirements: null,
      progress: null,
      recentActivity: [],
    });
  });

  it("compares a member's hours and meetings with what is expected so far", async () => {
    mockQueries([membership]);

    const overview = await makeService().overview("user-1", now);

    expect(overview.hours).toEqual({ meeting: 4, outreach: 2, total: 6 });
    expect(overview.requirements).toEqual({ meeting: 26, outreach: 5, track: "member" });
    expect(overview.progress).toEqual({
      completedMeetings: 2,
      attendedMeetings: 0,
      excusedMeetings: 1,
      missedMeetings: 1,
      completedMeetingHours: 7,
      scheduledMeetingHours: 10,
      expectedHours: { member: 18.2, leadership: 27.3 },
    });
    expect(overview.recentActivity[0]).toMatchObject({
      name: "Saturday build",
      status: "excused",
      hours: 4,
    });
    expect(overview.recentActivity[1]).toMatchObject({ name: "Outreach event" });
  });

  it("measures Student Leaders against the leadership meeting target", async () => {
    mockQueries([{ ...membership, role: "student_leader" }]);

    const overview = await makeService().overview("user-1", now);

    expect(overview.requirements).toEqual({ meeting: 39, outreach: 5, track: "leadership" });
  });

  it("still counts meetings for someone without an active membership", async () => {
    db.select
      .mockReturnValueOnce(query([season]))
      .mockReturnValueOnce(query(records))
      .mockReturnValueOnce(query([]))
      .mockReturnValueOnce(query(meetings));

    const overview = await makeService().overview("user-1", now);

    expect(overview.requirements).toBeNull();
    expect(overview.progress).toMatchObject({
      completedMeetings: 2,
      expectedHours: { member: null, leadership: null },
    });
    expect(db.select).toHaveBeenCalledTimes(4);
  });
});
