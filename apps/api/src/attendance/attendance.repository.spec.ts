import { Test, type TestingModule } from "@nestjs/testing";
import { DatabaseService } from "../database/database.service.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AttendanceCreate, AttendanceUpdate, AttendanceRepository } from "./attendance.repository.js";

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
      limit: vi.fn(), // set this every test
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      returning: vi.fn(), // set this every test
      execute: vi.fn().mockResolvedValue(undefined), // advisory lock no-op
    };

    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn(), // set this every test
      transaction: vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback(mockTx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceRepository,
        {
          provide: DatabaseService,
          useValue: {
            db: mockDb,
          },
        },
      ],
    }).compile();

    repository = module.get<AttendanceRepository>(AttendanceRepository);
  });

  it("should be defined", () => {
    expect(repository).toBeDefined();
  });

  describe("getLast", () => {
    it("should return the last attendance record for a user", async () => {
      const mockAttendance = {
        id: 1,
        user_id: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        checked_in_at: new Date("2026-10-31T14:00:00Z"),
        checked_out_at: new Date("2026-10-31T17:00:00Z"),
        category: "meeting",
        event_id: null,
      };

      mockDb.limit.mockResolvedValueOnce([mockAttendance]);

      const result = await repository.getLast("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");

      expect(result.isOk()).toBe(true);
      const attendance = result._unsafeUnwrap();
      expect(attendance).toEqual({
        id: 1,
        userId: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        checkedInAt: "2026-10-31T14:00:00.000Z",
        checkedOutAt: "2026-10-31T17:00:00.000Z",
        category: "meeting",
        eventId: null,
      });
    });

    it("should return null when there are no rows for the user", async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await repository.getLast("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual(null);
    });

    it("should return error when the row fails schema validation", async () => {
      const invalidRow = {
        id: 1,
        user_id: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        checked_in_at: new Date("2026-10-31T14:00:00Z"),
        checked_out_at: null,
        category: "invalid-category",
        event_id: null,
      };
      mockDb.limit.mockResolvedValueOnce([invalidRow]);

      const result = await repository.getLast("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");

      expect(result.isErr()).toBe(true);
    });
  });

  describe("createRecord", () => {
    it("should create and return a new attendance record when no open session exists", async () => {
      const mockRecord: AttendanceCreate = {
        userId: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        checkedInAt: new Date("2026-10-31T14:00:00Z"),
        category: "meeting",
        eventId: null,
      };

      mockTx.limit.mockResolvedValueOnce([]); // no existing open session
      mockTx.returning.mockResolvedValueOnce([{
        id: 1,
        user_id: mockRecord.userId,
        checked_in_at: mockRecord.checkedInAt,
        checked_out_at: null,
        category: mockRecord.category,
        event_id: null,
      }]);

      const result = await repository.createRecord(mockRecord);

      expect(result.isOk()).toBe(true);
      const createdRecord = result._unsafeUnwrap();
      expect(createdRecord).toEqual({
        id: 1,
        userId: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        checkedInAt: "2026-10-31T14:00:00.000Z",
        checkedOutAt: null,
        category: "meeting",
        eventId: null,
      });
    });

    it("should error when an open session already exists", async () => {
      const mockRecord: AttendanceCreate = {
        userId: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        checkedInAt: new Date("2026-10-31T14:00:00Z"),
        category: "meeting",
        eventId: null,
      };

      mockTx.limit.mockResolvedValueOnce([{ checked_out_at: null }]); // already signed in

      const result = await repository.createRecord(mockRecord);

      expect(result.isErr()).toBe(true);
    });

    it("should error when a row is not returned", async () => {
      const mockRecord: AttendanceCreate = {
        userId: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        checkedInAt: new Date("2026-10-31T14:00:00Z"),
        category: "meeting",
        eventId: null,
      };
      mockTx.limit.mockResolvedValueOnce([]);
      mockTx.returning.mockResolvedValueOnce([]);

      const result = await repository.createRecord(mockRecord);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(Error);
    });

    it("should insert using snake_case column names", async () => {
      const mockRecord: AttendanceCreate = {
        userId: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        checkedInAt: new Date("2026-10-31T14:00:00Z"),
        category: "meeting",
        eventId: null,
      };
      mockTx.limit.mockResolvedValueOnce([]);
      mockTx.returning.mockResolvedValueOnce([{
        id: 1,
        user_id: mockRecord.userId,
        checked_in_at: mockRecord.checkedInAt,
        checked_out_at: null,
        category: mockRecord.category,
        event_id: null,
      }]);

      await repository.createRecord(mockRecord);

      expect(mockTx.values).toHaveBeenCalledWith({
        user_id: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        checked_in_at: mockRecord.checkedInAt,
        checked_out_at: null,
        category: "meeting",
        event_id: null,
      });
    });
  });

  describe("updateLast", () => {
    it("should update the last attendance record for a user", async () => {
      const mockUpdates: AttendanceUpdate = {
        checkedOutAt: new Date("2026-10-31T17:00:00Z"),
        category: "outreach",
        eventId: 123,
      };

      mockTx.limit.mockResolvedValueOnce([{ id: 1 }]);
      mockTx.returning.mockResolvedValueOnce([{
        id: 1,
        user_id: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        checked_in_at: new Date("2026-10-31T14:00:00Z"),
        checked_out_at: new Date("2026-10-31T17:00:00Z"),
        category: "outreach",
        event_id: 123,
      }]);

      const result = await repository.updateLast("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", mockUpdates);

      expect(mockTx.set).toHaveBeenCalledWith({
        checked_out_at: mockUpdates.checkedOutAt,
        category: mockUpdates.category,
        event_id: mockUpdates.eventId,
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

    it("should conditionally build setObject", async () => {
      const mockUpdates: AttendanceUpdate = {
        checkedOutAt: new Date("2026-10-31T17:00:00Z"),
      };

      mockTx.limit.mockResolvedValueOnce([{ id: 1 }]);
      mockTx.returning.mockResolvedValueOnce([{
        id: 1,
        user_id: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        checked_in_at: new Date("2026-10-31T14:00:00Z"),
        checked_out_at: new Date("2026-10-31T17:00:00Z"),
        category: "meeting",
        event_id: null,
      }]);

      const result = await repository.updateLast("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", mockUpdates);

      expect(mockTx.set).toHaveBeenCalledWith({
        checked_out_at: mockUpdates.checkedOutAt,
      });
      expect(result.isOk()).toBe(true);
    });

    it("should error when no row id is found", async () => {
      mockTx.limit.mockResolvedValueOnce([]);

      const result = await repository.updateLast("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", {
        checkedOutAt: new Date("2026-10-31T17:00:00Z"),
      });

      expect(result.isErr()).toBe(true);
    });

    it("should error when no row is returned from the update", async () => {
      mockTx.limit.mockResolvedValueOnce([{ id: 1 }]);
      mockTx.returning.mockResolvedValueOnce([]);

      const result = await repository.updateLast("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", {
        checkedOutAt: new Date("2026-10-31T17:00:00Z"),
      });

      expect(result.isErr()).toBe(true);
    });
  });

  describe("getUserIdByDiscordId", () => {
    it("should return the userId for a given discordId", async () => {
      const mockUserId = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
      mockDb.limit.mockResolvedValueOnce([{ userId: mockUserId }]);
      const result = await repository.getUserIdByDiscordId("123456789012345678");

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual(mockUserId);
    });

    it("should error when no linked account is found", async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await repository.getUserIdByDiscordId("123456789012345678");

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(Error);
    });
  });
});