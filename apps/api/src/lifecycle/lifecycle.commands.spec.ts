import { Test, type TestingModule } from "@nestjs/testing";
import { MessageFlags } from "discord.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LifecycleCommands } from "./lifecycle.commands.js";
import { DatabaseService } from "./lifecycle.service.js";

// ─── Interaction helper ───────────────────────────────────────────────────────

function makeInteraction(ping = 42, username = "TestUser") {
  return {
    client: {
      ws: { ping },
    },
    user: {
      username,
    },
    reply: vi.fn().mockResolvedValue(undefined),
  };
}

// ─── Module factory ───────────────────────────────────────────────────────────

const databaseService = {
  checkConnection: vi.fn(),
};

async function makeModule(): Promise<TestingModule> {
  return Test.createTestingModule({
    providers: [LifecycleCommands, {
      provide: DatabaseService,
      useValue: databaseService,
    }],
  }).compile();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("LifecycleCommands", () => {
  let commands: LifecycleCommands;

  beforeEach(async () => {
    const module = await makeModule();
    commands = module.get(LifecycleCommands);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should be defined", () => {
    expect(commands).toBeDefined();
  });

  // ─── /ping ────────────────────────────────────────────────────────────────

  describe("onPing", () => {
    it("replies with Pong! and the ws ping in ms", async () => {
      const interaction = makeInteraction(123);

      await commands.onPing([interaction] as never);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Pong! 123ms",
        })
      );
    });

    it("replies with Ephemeral flag", async () => {
      const interaction = makeInteraction(50);

      await commands.onPing([interaction] as never);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          flags: [MessageFlags.Ephemeral],
        })
      );
    });

    it("calls reply exactly once", async () => {
      const interaction = makeInteraction();

      await commands.onPing([interaction] as never);

      expect(interaction.reply).toHaveBeenCalledTimes(1);
    });

    it("reflects the actual ws.ping value in the reply", async () => {
      const interaction = makeInteraction(999);

      await commands.onPing([interaction] as never);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Pong! 999ms",
        })
      );
    });

    it("returns the result of interaction.reply", async () => {
      const interaction = makeInteraction();
      const sentinel = Symbol("reply-result");
      interaction.reply.mockResolvedValue(sentinel as never);

      const result = await commands.onPing([interaction] as never);

      expect(result).toBe(sentinel);
    });

    it("propagates rejection if interaction.reply throws", async () => {
      const interaction = makeInteraction();
      interaction.reply.mockRejectedValue(new Error("Discord API error"));

      await expect(commands.onPing([interaction] as never)).rejects.toThrow("Discord API error");
    });
  });

  // ─── /greet ────────────────────────────────────────────────────────────────

  describe("onGreet", () => {
    it("replies with Hello, followed by the username and a positive message about the database connection if it's successful", async () => {
      const interaction = makeInteraction(50, "TestUser");
      databaseService.checkConnection.mockResolvedValue(true);

      await commands.onGreet([interaction] as never);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Hello, TestUser! The database connection is working.",
        })
      );
    });

    it("replies with Sorry, followed by the username and a negative message about the database connection if it's unsuccessful", async () => {
      const interaction = makeInteraction(50, "TestUser");
      databaseService.checkConnection.mockResolvedValue(false);

      await commands.onGreet([interaction] as never);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Sorry, TestUser! The database connection is not working.",
        })
      );
    });

    it("replies with Sorry, followed by the username and a clarifying message about lack of info if the connection checker fails", async () => {
      const interaction = makeInteraction(50, "TestUser");
      databaseService.checkConnection.mockResolvedValue(null);

      await commands.onGreet([interaction] as never);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Sorry, TestUser! The database connection checker failed to determine the connection status.",
        })
      );
    });

    it("replies with Ephemeral flag", async () => {
      const interaction = makeInteraction();

      await commands.onGreet([interaction] as never);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          flags: [MessageFlags.Ephemeral],
        })
      );
    });

    it("calls reply exactly once", async () => {
      const interaction = makeInteraction();

      await commands.onGreet([interaction] as never);

      expect(interaction.reply).toHaveBeenCalledTimes(1);
    });

    it("reflects the actual username in the reply", async () => {
      const interaction = makeInteraction(400, "OtherTestName");
      databaseService.checkConnection.mockResolvedValue(false);

      await commands.onGreet([interaction] as never);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Sorry, OtherTestName! The database connection is not working.",
        })
      );
    });

    it("returns the result of interaction.reply", async () => {
      const interaction = makeInteraction();
      const sentinel = Symbol("reply-result");
      interaction.reply.mockResolvedValue(sentinel as never);

      const result = await commands.onGreet([interaction] as never);

      expect(result).toBe(sentinel);
    });

    it("propagates rejection if interaction.reply throws", async () => {
      const interaction = makeInteraction();
      interaction.reply.mockRejectedValue(new Error("Discord API error"));

      await expect(commands.onGreet([interaction] as never)).rejects.toThrow("Discord API error");
    });
  });
});