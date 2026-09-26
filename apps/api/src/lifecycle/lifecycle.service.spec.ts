import { Test, type TestingModule } from "@nestjs/testing";
import { ActivityType } from "discord.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LifecycleService } from "./lifecycle.service.js";
import { DatabaseService } from "../database/database.service.js";

const execute = vi.fn();

// ─── Client helper ────────────────────────────────────────────────────────────

function makeClient(username = "TestBot") {
  return {
    user: {
      username,
      setActivity: vi.fn(),
    },
  };
}

// ─── Module factory ───────────────────────────────────────────────────────────

async function makeModule(): Promise<TestingModule> {
  return Test.createTestingModule({
    providers: [
      LifecycleService,
      { provide: DatabaseService, useValue: { db: { execute } } },
    ],
  }).compile();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("LifecycleService", () => {
  let service: LifecycleService;
  let module: TestingModule;

  beforeEach(async () => {
    execute.mockReset();
    module = await makeModule();
    service = module.get(LifecycleService);
  });

  afterEach(async () => {
    await module.close();
    vi.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  // ─── onReady ──────────────────────────────────────────────────────────────

  describe("onReady", () => {
    it("logs the bot username when ready", async () => {
      const client = makeClient("YetiBot");
      // biome-ignore lint/complexity/useLiteralKeys: accessing private field in test
      const logSpy = vi.spyOn(service["logger"], "log");

      await service.onReady([client] as never);

      expect(logSpy).toHaveBeenCalledWith("Bot logged in as YetiBot");
    });

    it("sets activity to 'YETI ARE YOU READY?' with Custom type", async () => {
      const client = makeClient("YetiBot");

      await service.onReady([client] as never);

      expect(client.user.setActivity).toHaveBeenCalledWith("YETI ARE YOU READY?", {
        type: ActivityType.Custom,
      });
    });

    it("calls setActivity exactly once", async () => {
      const client = makeClient();

      await service.onReady([client] as never);

      expect(client.user.setActivity).toHaveBeenCalledTimes(1);
    });

    it("logs with username from client.user.username", async () => {
      const client = makeClient("AnotherBot");
      // biome-ignore lint/complexity/useLiteralKeys: accessing private field in test
      const logSpy = vi.spyOn(service["logger"], "log");

      await service.onReady([client] as never);

      expect(logSpy).toHaveBeenCalledWith("Bot logged in as AnotherBot");
    });

    it("resolves without returning a value (void)", async () => {
      const client = makeClient();

      const result = await service.onReady([client] as never);

      expect(result).toBeUndefined();
    });
  });

  // ─── checkConnection ──────────────────────────────────────────────────────────────
  describe("checkConnection", () => {
    it("returns true when the database connection is working", async () => {
      execute.mockResolvedValue({ rows: [{ connected: 1 }] });

      const result = await service.checkConnection();

      expect(result).toBe(true);
    });

    it("returns false when the database connection is not working", async () => {
      execute.mockRejectedValue(new Error("Database connection error"));

      const result = await service.checkConnection();

      expect(result).toBe(false);
    });
  });
});
