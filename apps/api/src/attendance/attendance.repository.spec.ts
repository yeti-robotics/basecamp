import { Test, type TestingModule } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseService } from "../database/database.service.js";
import {
  AttendanceCreate,
  AttendanceUpdate,
  AttendanceRepository,
} from "./attendance.repository.js";

describe("AttendanceRepository", () => {
  let repository: AttendanceRepository;
  let mockDb: any;
  let mockTx: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockTx = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      returning: vi.fn(),
      execute: vi.fn().mockResolvedValue(undefined),
    };

    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn(),
      transaction: vi.fn(
        async (callback: (tx: any) => Promise<unknown>) => callback(mockTx),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceRepository,
        {
          provide: DatabaseService,
          useValue: { db: mockDb },
        },
      ],
    }).compile();

    repository = module.get<AttendanceRepository>(AttendanceRepository);
  });

  it("should be defined", () => {
    expect(repository).toBeDefined();
  });

  describe("getLast", () => {
    it("returns the last attendance record for a user", async () => {
      const mockAttendance = {
        id: 1,
        user_id: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        checked_in_at: new Date("2026-10-31T14:00:00Z"),
        checked_out_at: new Date("2026-10-31T17:00:00Z"),
        category: "meeting",
        event_id: null,
      };

      mockDb.limit.mockResolvedValueOnce([mockAttendance]);

      const result = await repository.getLast(
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      );

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual({
        id: 1,
        userId: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        checkedInAt: "2026-10-31T14:00:00.000Z",
        checkedOutAt: "2026-10-31T17:00:00.000Z",
        category: "meeting",
        eventId: null,
      });
    });

    it("returns null when there are no rows for the user", async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await repository.getLast(
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      );

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual(null);
    });

    it("returns an error when the row fails schema validation", async () => {
      mockDb.limit.mockResolvedValueOnce([
        {
          id: 1,
          user_id: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          checked_in_at: new Date("2026-10-31T14:00:00Z"),
          checked_out_at: null,
          category: "invalid-category",
          event_id: null,
        },
      ]);

      const result = await repository.getLast(
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      );

      expect(result.isErr()).toBe(true);
    });
  });

  describe("createRecord", () => {
    it("creates and returns a record when no open session exists", async () => {
      const record: AttendanceCreate = {
        userId: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        checkedInAt: new Date("2026-10-31T14:00:00Z"),
        category: "meeting",
        eventId: null,
      };

      mockTx.limit.mockResolvedValueOnce([]);
      mockTx.returning.mockResolvedValueOnce([
        {
          id: 1,
          user_id: record.userId,
          checked_in_at: record.checkedInAt,
          checked_out_at: null,
          category: record.category,
          event_id: null,
        },
      ]);

      const result = await repository.createRecord(record);

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual({
        id: 1,
        userId: record.userId,
        checkedInAt: "2026-10-31T14:00:00.000Z",
        checkedOutAt: null,
        category: "meeting",
        eventId: null,
      });
    });

    it("errors when an open session already exists", async () => {
      const record: AttendanceCreate = {
        userId: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        checkedInAt: new Date("2026-10-31T14:00:00Z"),
        category: "meeting",
        eventId: null,
      };

      mockTx.limit.mockResolvedValueOnce([{ checked_out_at: null }]);

      const result = await repository.createRecord(record);

      expect(result.isErr()).toBe(true);
    });

    it("errors when no row is returned from the insert", async () => {
      const record: AttendanceCreate = {
        userId: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        checkedInAt: new Date("2026-10-31T14:00:00Z"),
        category: "meeting",
        eventId: null,
      };

      mockTx.limit.mockResolvedValueOnce([]);
      mockTx.returning.mockResolvedValueOnce([]);

      const result = await repository.createRecord(record);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(Error);
    });

    it("inserts using snake_case column names", async () => {
      const record: AttendanceCreate = {
        userId: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        checkedInAt: new Date("2026-10-31T14:00:00Z"),
        category: "meeting",
        eventId: null,
      };

      mockTx.limit.mockResolvedValueOnce([]);
      mockTx.returning.mockResolvedValueOnce([
        {
          id: 1,
          user_id: record.userId,
          checked_in_at: record.checkedInAt,
          checked_out_at: null,
          category: record.category,
          event_id: null,
        },
      ]);

      await repository.createRecord(record);

      expect(mockTx.values).toHaveBeenCalledWith({
        user_id: record.userId,
        checked_in_at: record.checkedInAt,
        checked_out_at: null,
        category: "meeting",
        event_id: null,
      });
    });
  });

  describe("updateLast", () => {
    it("updates the last attendance record for a user", async () => {
      const updates: AttendanceUpdate = {
        checkedOutAt: new Date("2026-10-31T17:00:00Z"),
        category: "outreach",
        eventId: 123,
      };

      mockTx.limit.mockResolvedValueOnce([{ id: 1 }]);
      mockTx.returning.mockResolvedValueOnce([
        {
          id: 1,
          user_id: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          checked_in_at: new Date("2026-10-31T14:00:00Z"),
          checked_out_at: new Date("2026-10-31T17:00:00Z"),
          category: "outreach",
          event_id: 123,
        },
      ]);

      const result = await repository.updateLast(
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        updates,
      );

      expect(mockTx.set).toHaveBeenCalledWith({
        checked_out_at: updates.checkedOutAt,
        category: "outreach",
        event_id: 123,
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual({
        id: 1,
        userId: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        checkedInAt: "2026-10-31T14:00:00.000Z",
        checkedOutAt: "2026-10-31T17:00:00.000Z",
        category: "outreach",
        eventId: 123,
      });
    });

    it("only sets fields included in the update", async () => {
      const updates: AttendanceUpdate = {
        checkedOutAt: new Date("2026-10-31T17:00:00Z"),
      };

      mockTx.limit.mockResolvedValueOnce([{ id: 1 }]);
      mockTx.returning.mockResolvedValueOnce([
        {
          id: 1,
          user_id: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          checked_in_at: new Date("2026-10-31T14:00:00Z"),
          checked_out_at: new Date("2026-10-31T17:00:00Z"),
          category: "meeting",
          event_id: null,
        },
      ]);

      const result = await repository.updateLast(
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        updates,
      );

      expect(mockTx.set).toHaveBeenCalledWith({
        checked_out_at: updates.checkedOutAt,
      });
      expect(result.isOk()).toBe(true);
    });

    it("errors when no row ID is found", async () => {
      mockTx.limit.mockResolvedValueOnce([]);

      const result = await repository.updateLast(
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        { checkedOutAt: new Date("2026-10-31T17:00:00Z") },
      );

      expect(result.isErr()).toBe(true);
    });

    it("errors when no row is returned from the update", async () => {
      mockTx.limit.mockResolvedValueOnce([{ id: 1 }]);
      mockTx.returning.mockResolvedValueOnce([]);

      const result = await repository.updateLast(
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        { checkedOutAt: new Date("2026-10-31T17:00:00Z") },
      );

      expect(result.isErr()).toBe(true);
    });
  });

  describe("getUserIdByDiscordId", () => {
    it("returns the user ID for a Discord ID", async () => {
      const userId = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
      mockDb.limit.mockResolvedValueOnce([{ userId }]);

      const result = await repository.getUserIdByDiscordId(
        "123456789012345678",
      );

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBe(userId);
    });

    it("errors when no linked account is found", async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await repository.getUserIdByDiscordId(
        "123456789012345678",
      );

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(Error);
    });
  });

  describe("getCurrentHourRequirements", () => {
    it("is exposed by the repository", () => {
      expect(repository.getCurrentHourRequirements).toBeTypeOf("function");
    });
  });
});