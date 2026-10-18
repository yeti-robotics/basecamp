import { Test, type TestingModule } from "@nestjs/testing";
import { errAsync, okAsync } from "neverthrow";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockedFunction,
  vi,
} from "vitest";
import { AttendanceCommands } from "./attendance.commands.js";
import { AttendanceService } from "./attendance.service.js";
import type { AttendanceRequirementSummary } from "./attendance.repository.js";
import { getTotalSeasonHours } from "./schedule.util.js";

function makeInteraction(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: "123456789012345678" },
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

type MockAttendanceService = {
  recordAttendance: MockedFunction<AttendanceService["recordAttendance"]>;
  updateAttendance: MockedFunction<AttendanceService["updateAttendance"]>;
  getAttendanceSum: MockedFunction<AttendanceService["getAttendanceSum"]>;
  getCurrentHourRequirements: MockedFunction<
    AttendanceService["getCurrentHourRequirements"]
  >;
  getTotalPossibleHoursToDate: MockedFunction<
    AttendanceService["getTotalPossibleHoursToDate"]
  >;
};

const defaultRequirements: AttendanceRequirementSummary = {
  status: "rookie",
  member: 100,
  leadership: 150,
};

function makeModule() {
  return Test.createTestingModule({
    providers: [
      AttendanceCommands,
      {
        provide: AttendanceService,
        useValue: {
          recordAttendance: vi.fn(),
          updateAttendance: vi.fn(),
          getAttendanceSum: vi.fn(),
          getCurrentHourRequirements: vi.fn(),
          getTotalPossibleHoursToDate: vi.fn().mockReturnValue(100),
        } satisfies MockAttendanceService,
      },
    ],
  }).compile();
}

describe("AttendanceCommands", () => {
  let commands: AttendanceCommands;
  let service: MockAttendanceService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await makeModule();
    commands = module.get(AttendanceCommands);
    service = module.get(AttendanceService);
  });

  afterEach(async () => {
    await module.close();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("is defined", () => {
    expect(commands).toBeDefined();
  });

  describe("AttendanceCommand", () => {
    it("uses the member message and matches the legacy message format", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));

      const interaction = makeInteraction();

      service.getAttendanceSum.mockReturnValue(okAsync(25));
      service.getCurrentHourRequirements.mockReturnValue(
        okAsync(defaultRequirements),
      );

      await commands.AttendanceCommand([interaction] as never);

      const totalSeasonHours = getTotalSeasonHours(
        new Date("2026-10-18T12:00:00Z"),
      );
      const leadershipTargetToDate =
        (100 * defaultRequirements.leadership) / totalSeasonHours;
      const leadershipHoursBehind = Math.ceil(
        Math.max(0, leadershipTargetToDate - 25),
      );

      expect(interaction.deferReply).toHaveBeenCalledTimes(1);
      expect(interaction.editReply).toHaveBeenCalledTimes(1);
      expect(interaction.editReply).toHaveBeenCalledWith(
        `You're currently above the minimum hours for members (25.00 hours, 25.0% of 100 possible hours to date)! If you're on leadership, you are currently ${leadershipHoursBehind} hour(s) behind the leadership requirement.`,
      );
    });

    it("uses the leadership message when its minimum-to-date is met", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));

      const interaction = makeInteraction();

      service.getAttendanceSum.mockReturnValue(okAsync(150));
      service.getCurrentHourRequirements.mockReturnValue(
        okAsync(defaultRequirements),
      );

      await commands.AttendanceCommand([interaction] as never);

      expect(interaction.editReply).toHaveBeenCalledWith(
        "You're currently above the minimum hours for leadership (150.00 hours, 150.0% of 100 possible hours to date)! :tada:",
      );
    });

    it("uses the member message when the member minimum is met but leadership is not", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));

      const interaction = makeInteraction();
      const requirements = {
        status: "rookie" as const,
        member: 15,
        leadership: 40,
      };

      service.getAttendanceSum.mockReturnValue(okAsync(5));
      service.getCurrentHourRequirements.mockReturnValue(
        okAsync(requirements),
      );

      await commands.AttendanceCommand([interaction] as never);

      const leadershipTargetToDate =
        (100 * requirements.leadership) /
        getTotalSeasonHours(new Date("2026-10-18T12:00:00Z"));
      const leadershipHoursBehind = Math.ceil(
        Math.max(0, leadershipTargetToDate - 5),
      );

      expect(interaction.editReply).toHaveBeenCalledWith(
        `You're currently above the minimum hours for members (5.00 hours, 5.0% of 100 possible hours to date)! If you're on leadership, you are currently ${leadershipHoursBehind} hour(s) behind the leadership requirement.`,
      );
    });

    it("compares hours against the configured season minimum scaled to date", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));

      const interaction = makeInteraction();

      service.getAttendanceSum.mockReturnValue(okAsync(93.86));
      service.getCurrentHourRequirements.mockReturnValue(
        okAsync({
          status: "rookie",
          member: 313,
          leadership: 354,
        }),
      );
      service.getTotalPossibleHoursToDate.mockReturnValue(66);

      await commands.AttendanceCommand([interaction] as never);

      expect(interaction.editReply).toHaveBeenCalledWith(
        "You're currently above the minimum hours for leadership (93.86 hours, 142.2% of 66 possible hours to date)! :tada:",
      );
    });

    it("uses the membership status requirements returned by the database", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));

      const interaction = makeInteraction();
      const veteranRequirements = {
        ...defaultRequirements,
        status: "veteran" as const,
      };

      service.getAttendanceSum.mockReturnValue(okAsync(0));
      service.getCurrentHourRequirements.mockReturnValue(
        okAsync(veteranRequirements),
      );

      await commands.AttendanceCommand([interaction] as never);

      expect(service.getCurrentHourRequirements).toHaveBeenCalledWith(
        "123456789012345678",
        expect.any(Date),
      );
      expect(interaction.editReply).toHaveBeenCalledTimes(1);
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.stringContaining("behind the minimum hours goal."),
      );
    });

    it("handles a missing membership or requirement lookup failure", async () => {
      const interaction = makeInteraction();

      service.getAttendanceSum.mockReturnValue(okAsync(10));
      service.getCurrentHourRequirements.mockReturnValue(
        errAsync(new Error("No active season membership found")),
      );

      await commands.AttendanceCommand([interaction] as never);

      expect(interaction.editReply).toHaveBeenCalledWith(
        "There was an error getting your attendance or hour requirements. Please let a mentor know.",
      );
    });

    it("handles an attendance hours lookup failure", async () => {
      const interaction = makeInteraction();

      service.getAttendanceSum.mockReturnValue(
        errAsync(new Error("Database unavailable")),
      );
      service.getCurrentHourRequirements.mockReturnValue(
        okAsync(defaultRequirements),
      );

      await commands.AttendanceCommand([interaction] as never);

      expect(interaction.editReply).toHaveBeenCalledWith(
        "There was an error getting your attendance or hour requirements. Please let a mentor know.",
      );
    });

    it("handles zero-hour requirements", async () => {
      const interaction = makeInteraction();

      service.getAttendanceSum.mockReturnValue(okAsync(0));
      service.getCurrentHourRequirements.mockReturnValue(
        okAsync({
          status: "rookie",
          member: 0,
          leadership: 0,
        }),
      );

      await commands.AttendanceCommand([interaction] as never);

      expect(interaction.editReply).toHaveBeenCalledWith(
        "You're currently above the minimum hours for leadership (0.00 hours, 0.0% of 100 possible hours to date)! :tada:",
      );
    });
  });

  describe("SigninCommand", () => {
    it("defers before recording attendance", async () => {
      const interaction = makeInteraction();

      service.recordAttendance.mockReturnValue(okAsync(undefined));

      await commands.SigninCommand([interaction] as never);

      expect(interaction.deferReply).toHaveBeenCalledTimes(1);
      expect(interaction.deferReply.mock.invocationCallOrder[0]).toBeLessThan(
        service.recordAttendance.mock.invocationCallOrder[0],
      );
    });

    it("replies with a friendly message when the user is already signed in", async () => {
      const interaction = makeInteraction();

      service.recordAttendance.mockReturnValue(
        errAsync(new Error("User is already signed in")),
      );

      await commands.SigninCommand([interaction] as never);

      expect(interaction.editReply).toHaveBeenCalledWith(
        "You're already signed in.",
      );
    });

    it("replies with a generic error message for other failures", async () => {
      const interaction = makeInteraction();

      service.recordAttendance.mockReturnValue(
        errAsync(new Error("Something unexpected")),
      );

      await commands.SigninCommand([interaction] as never);

      expect(interaction.editReply).toHaveBeenCalledWith(
        "Something went wrong while signing you in. Please try again later or contact a web dev mentor if the issue persists.",
      );
    });

    it("replies with a success message when recordAttendance succeeds", async () => {
      const interaction = makeInteraction();

      service.recordAttendance.mockReturnValue(okAsync(undefined));

      await commands.SigninCommand([interaction] as never);

      expect(interaction.editReply).toHaveBeenCalledWith(
        "<@123456789012345678> has signed in.",
      );
    });
  });

  describe("SignoutCommand", () => {
    it("defers before updating attendance", async () => {
      const interaction = makeInteraction();

      service.updateAttendance.mockReturnValue(okAsync(undefined));

      await commands.SignoutCommand([interaction] as never);

      expect(interaction.deferReply).toHaveBeenCalledTimes(1);
      expect(interaction.deferReply.mock.invocationCallOrder[0]).toBeLessThan(
        service.updateAttendance.mock.invocationCallOrder[0],
      );
    });

    it("replies with the correct error message when user is already signed out", async () => {
      const interaction = makeInteraction();

      service.updateAttendance.mockReturnValue(
        errAsync(new Error("User is already signed out")),
      );

      await commands.SignoutCommand([interaction] as never);

      expect(interaction.editReply).toHaveBeenCalledWith(
        "You're already signed out.",
      );
    });

    it("replies with the correct error message when user has never signed in", async () => {
      const interaction = makeInteraction();

      service.updateAttendance.mockReturnValue(
        errAsync(
          new Error(
            "User was not signed out because they have not signed in yet",
          ),
        ),
      );

      await commands.SignoutCommand([interaction] as never);

      expect(interaction.editReply).toHaveBeenCalledWith(
        "You need to sign in before signing out.",
      );
    });

    it("replies with a generic error message if not caught in ternaries", async () => {
      const interaction = makeInteraction();

      service.updateAttendance.mockReturnValue(
        errAsync(new Error("Unknown Error")),
      );

      await commands.SignoutCommand([interaction] as never);

      expect(interaction.editReply).toHaveBeenCalledWith(
        "Something went wrong while signing you out. Please try again later or contact a web dev mentor if the issue persists.",
      );
    });

    it("replies with a success message when updateAttendance succeeds", async () => {
      const interaction = makeInteraction();

      service.updateAttendance.mockReturnValue(okAsync(undefined));

      await commands.SignoutCommand([interaction] as never);

      expect(interaction.editReply).toHaveBeenCalledWith(
        "<@123456789012345678> has signed out.",
      );
    });

    it("passes the user id and a checkedOutAt time to updateAttendance", async () => {
      const interaction = makeInteraction();

      service.updateAttendance.mockReturnValue(okAsync(undefined));

      await commands.SignoutCommand([interaction] as never);

      expect(service.updateAttendance).toHaveBeenCalledWith(
        "123456789012345678",
        {
          checkedOutAt: expect.any(Date),
        },
      );
    });
  });
});