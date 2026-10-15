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

function makeInteraction(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: "123456789012345678" },
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
    vi.clearAllMocks();
  });

  it("is defined", () => {
    expect(commands).toBeDefined();
  });

  describe("AttendanceCommand", () => {
    it("looks up meeting hours and displays both meeting minimums", async () => {
      const interaction = makeInteraction();

      service.getAttendanceSum.mockReturnValue(okAsync(25));
      service.getCurrentHourRequirements.mockReturnValue(
        okAsync(defaultRequirements),
      );

      await commands.AttendanceCommand([interaction] as never);

      expect(service.getAttendanceSum).toHaveBeenCalledTimes(1);
      expect(service.getAttendanceSum).toHaveBeenCalledWith(
        "123456789012345678",
        {
          category: "meeting",
          checkedInFrom: expect.any(Date),
          checkedInThrough: expect.any(Date),
        },
      );
      expect(service.getCurrentHourRequirements).toHaveBeenCalledWith(
        "123456789012345678",
        expect.any(Date),
      );

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.stringContaining("- Meeting hours: 25.00"),
      );
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.stringContaining("- Member minimum: 25.00 / 100 hours"),
      );
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.stringContaining("- Leadership minimum: 25.00 / 150 hours"),
      );
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.stringContaining(
          "You've got 25.00 hours (25.0% of 100 possible hours to date). You are currently 75 hour(s) behind the minimum hours goal. :rocket:",
        ),
      );
    });

    it("uses the membership status returned by the database", async () => {
      const interaction = makeInteraction();

      service.getAttendanceSum.mockReturnValue(okAsync(0));
      service.getCurrentHourRequirements.mockReturnValue(
        okAsync({
          ...defaultRequirements,
          status: "veteran",
        }),
      );

      await commands.AttendanceCommand([interaction] as never);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.stringContaining("Attendance for veteran"),
      );
    });

    it("uses the member response when the member meeting minimum is met", async () => {
      const interaction = makeInteraction();

      service.getAttendanceSum.mockReturnValue(okAsync(20));
      service.getCurrentHourRequirements.mockReturnValue(
        okAsync({
          status: "rookie",
          member: 15,
          leadership: 40,
        }),
      );

      await commands.AttendanceCommand([interaction] as never);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.stringContaining(
          "You're currently above the minimum hours for members (20.00 hours, 20.0% of 100 possible hours to date)!",
        ),
      );
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.stringContaining(
          "you are currently 20 hour(s) behind the leadership requirement.",
        ),
      );
    });

    it("uses the leadership response when the leadership meeting minimum is met", async () => {
      const interaction = makeInteraction();

      service.getAttendanceSum.mockReturnValue(okAsync(150));
      service.getCurrentHourRequirements.mockReturnValue(
        okAsync(defaultRequirements),
      );

      await commands.AttendanceCommand([interaction] as never);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.stringContaining(
          "You're currently above the minimum hours for leadership (150.00 hours, 150.0% of 100 possible hours to date)! :tada:",
        ),
      );
    });

    it("handles a missing membership or requirement lookup failure", async () => {
      const interaction = makeInteraction();

      service.getAttendanceSum.mockReturnValue(okAsync(10));
      service.getCurrentHourRequirements.mockReturnValue(
        errAsync(new Error("No active season membership found")),
      );

      await commands.AttendanceCommand([interaction] as never);

      expect(interaction.reply).toHaveBeenCalledWith({
        content:
          "There was an error getting your attendance or hour requirements. Please let a mentor know.",
        flags: ["Ephemeral"],
      });
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

      expect(interaction.reply).toHaveBeenCalledWith({
        content:
          "There was an error getting your attendance or hour requirements. Please let a mentor know.",
        flags: ["Ephemeral"],
      });
    });

    it("handles zero-hour requirements without dividing by zero", async () => {
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

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.stringContaining("- Member minimum: 0.00 / 0 hours"),
      );
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.stringContaining("- Leadership minimum: 0.00 / 0 hours"),
      );
    });
  });

  describe("SigninCommand", () => {
    it("replies with a friendly message when the user is already signed in", async () => {
      const interaction = makeInteraction();

      service.recordAttendance.mockReturnValue(
        errAsync(new Error("User is already signed in")),
      );

      await commands.SigninCommand([interaction] as never);

      expect(interaction.reply).toHaveBeenCalledWith({
        content: "You're already signed in.",
        flags: ["Ephemeral"],
      });
    });

    it("replies with a generic error message for other failures", async () => {
      const interaction = makeInteraction();

      service.recordAttendance.mockReturnValue(
        errAsync(new Error("Something unexpected")),
      );

      await commands.SigninCommand([interaction] as never);

      expect(interaction.reply).toHaveBeenCalledWith({
        content:
          "Something went wrong while signing you in. Please try again later or contact a web dev mentor if the issue persists.",
        flags: ["Ephemeral"],
      });
    });

    it("replies with a success message when recordAttendance succeeds", async () => {
      const interaction = makeInteraction();

      service.recordAttendance.mockReturnValue(okAsync(undefined));

      await commands.SigninCommand([interaction] as never);

      expect(interaction.reply).toHaveBeenCalledWith(
        "<@123456789012345678> has signed in.",
      );
    });
  });

  describe("SignoutCommand", () => {
    it("replies with the correct error message when user is already signed out", async () => {
      const interaction = makeInteraction();

      service.updateAttendance.mockReturnValue(
        errAsync(new Error("User is already signed out")),
      );

      await commands.SignoutCommand([interaction] as never);

      expect(interaction.reply).toHaveBeenCalledWith({
        content: "You're already signed out.",
        flags: ["Ephemeral"],
      });
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

      expect(interaction.reply).toHaveBeenCalledWith({
        content: "You need to sign in before signing out.",
        flags: ["Ephemeral"],
      });
    });

    it("replies with a generic error message if not caught in ternaries", async () => {
      const interaction = makeInteraction();

      service.updateAttendance.mockReturnValue(
        errAsync(new Error("Unknown Error")),
      );

      await commands.SignoutCommand([interaction] as never);

      expect(interaction.reply).toHaveBeenCalledWith({
        content:
          "Something went wrong while signing you out. Please try again later or contact a web dev mentor if the issue persists.",
        flags: ["Ephemeral"],
      });
    });

    it("replies with a success message when updateAttendance succeeds", async () => {
      const interaction = makeInteraction();

      service.updateAttendance.mockReturnValue(okAsync(undefined));

      await commands.SignoutCommand([interaction] as never);

      expect(interaction.reply).toHaveBeenCalledWith(
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