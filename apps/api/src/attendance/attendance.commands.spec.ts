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

// ─── Discord interaction helpers ─────────────────────────────────────────────

function makeInteraction(overrides: Record<string, unknown> = {}) {
  const interaction = {
    user: { id: "123456789012345678" },
    reply: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };

  return interaction;
}

// ─── Service mock type ────────────────────────────────────────────────────────

type MockAttendanceService = {
  recordAttendance: MockedFunction<AttendanceService["recordAttendance"]>;
  updateAttendance: MockedFunction<AttendanceService["updateAttendance"]>;
};

// ─── Module factory ───────────────────────────────────────────────────────────

function makeModule() {
  return Test.createTestingModule({
    providers: [
      AttendanceCommands,
      {
        provide: AttendanceService,
        useValue: {
          recordAttendance: vi.fn(),
          updateAttendance: vi.fn(),
        } satisfies MockAttendanceService,
      },
    ],
  }).compile();
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("AttendanceCommands", () => {
  let commands: AttendanceCommands;
  let service: MockAttendanceService;

  beforeEach(async () => {
    const module: TestingModule = await makeModule();
    commands = module.get(AttendanceCommands);
    service = module.get(AttendanceService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should be defined", () => {
    expect(commands).toBeDefined();
  });

  // ─── /signin ───────────────────────────────────────────────────────────────

  describe("SigninCommand", () => {
    it("replies with the error message when recordAttendance errors", async () => {
      const interaction = makeInteraction();

      service.recordAttendance.mockReturnValue(
        errAsync(new Error("User is already signed in")),
      );

      await commands.SigninCommand([interaction] as never);

      expect(interaction.reply).toHaveBeenCalledWith({
        content:
          "Error signing in: User is already signed in. Please try again later or contact a web dev mentor if issue persists.",
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

    it("passes the user id, meeting category, and null event id to recordAttendance", async () => {
      const interaction = makeInteraction();

      service.recordAttendance.mockReturnValue(okAsync(undefined));

      await commands.SigninCommand([interaction] as never);

      expect(service.recordAttendance).toHaveBeenCalledWith(
        "123456789012345678",
        "meeting",
        null,
      );
    });
  });

  // ─── /signout ──────────────────────────────────────────────────────────────

  describe("SignoutCommand", () => {
    it("replies with the error message when updateAttendance errors", async () => {
      const interaction = makeInteraction();

      service.updateAttendance.mockReturnValue(
        errAsync(new Error("User is already signed out")),
      );

      await commands.SignoutCommand([interaction] as never);

      expect(interaction.reply).toHaveBeenCalledWith({
        content:
          "Error signing out: User is already signed out. Please try again later or contact a web dev mentor if issue persists.",
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
