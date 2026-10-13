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

      service.recordAttendance.mockReturnValue(errAsync(new Error("Something unexpected")));

      await commands.SigninCommand([interaction] as never);

      expect(interaction.reply).toHaveBeenCalledWith({
        content:
          "Something went wrong while signing you in. Please try again later or contact a web dev mentor if the issue persists.",
        flags: ["Ephemeral"],
      });
    });
})

  // ─── /signout ──────────────────────────────────────────────────────────────

  describe("SignoutCommand", () => {
    it("replies with the correct error message when user is already signed out", async () => {
      const interaction = makeInteraction();

      service.updateAttendance.mockReturnValue(
        errAsync(new Error("User is already signed out")),
      );

      await commands.SignoutCommand([interaction] as never);

      expect(interaction.reply).toHaveBeenCalledWith({
        content:
          "You're already signed out.",
        flags: ["Ephemeral"],
      });
    });

    it("replies with the correct error message when user has never signed in", async () => {
      const interaction = makeInteraction();

      service.updateAttendance.mockReturnValue(
        errAsync(new Error("User was not signed out because they have not signed in yet")),
      );

      await commands.SignoutCommand([interaction] as never);

      expect(interaction.reply).toHaveBeenCalledWith({
        content:
          "You need to sign in before signing out.",
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