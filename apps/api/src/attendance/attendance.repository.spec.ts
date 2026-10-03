import { Test, type TestingModule } from "@nestjs/testing";
import { ResultAsync } from "neverthrow";
import { DatabaseService } from "../database/database.service.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AttendanceCreate, AttendanceUpdate, AttendanceRepository } from "./attendance.repository.js";
import type { Attendance } from "./attendance.schema.ts";

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
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn(), // set this every test
  };

    mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn(), // set this every test
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(), // set this every test
    transaction: vi.fn(async (callback: (tx: any) => Promise<unknown>) => callback(mockTx)), // set this every test
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

      mockDb.limit.mockReturnValueOnce([mockAttendance]);

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
      mockDb.limit.mockReturnValueOnce([]);

      const result = await repository.getLast("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");

      expect(result.isOk()).toBe(true);
      const attendance = result._unsafeUnwrap();
      expect(attendance).toEqual(null);
    });

it("should return error when the row fails schema validation", async () => {
  const invalidRow = {
    id: 1,
    user_id: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    checked_in_at: new Date("2026-10-31T14:00:00Z"),
    checked_out_at: null,
    category: "invalid-category", //should fail
    event_id: null,
  };
  mockDb.limit.mockReturnValueOnce([invalidRow]);

  const result = await repository.getLast("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");

  expect(result.isErr()).toBe(true);
});

});

describe("createRecord", () => {
it("should create and return a new attendance record", async () => {
    const mockRecord: AttendanceCreate = {
    userId: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    checkedInAt: new Date("2026-10-31T14:00:00Z"),
    category: "meeting",
    eventId: null,
      };

    const insertedRow = {
        id: 1,
        user_id: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        checked_in_at: new Date("2026-10-31T14:00:00Z"),
        checked_out_at: null,
        category: "meeting",
        event_id: null,
    };
    mockDb.returning.mockReturnValueOnce([insertedRow]);

      const result = await repository.createRecord(mockRecord);

      expect(result.isOk()).toBe(true);
      const createdRecord = result._unsafeUnwrap();
      expect(createdRecord).toEqual({
        id: expect.any(Number),
        userId: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        checkedInAt: "2026-10-31T14:00:00.000Z",
        checkedOutAt: null,
        category: "meeting",
        eventId: null,
      });
    });
it("should error when a row is not returned", async () => {
    const mockRecord: AttendanceCreate = {
    userId: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    checkedInAt: new Date("2026-10-31T14:00:00Z"),
    category: "meeting",
    eventId: null,
      };
    mockDb.returning.mockReturnValueOnce([]);

      const result = await repository.createRecord(mockRecord);

      expect(result.isErr()).toBe(true);
      const createdRecord = result._unsafeUnwrapErr();
      expect(createdRecord).toBeInstanceOf(Error);
    });

it("should insert using snake_case column names", async () => {
  const mockRecord: AttendanceCreate = {
    userId: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    checkedInAt: new Date("2026-10-31T14:00:00Z"),
    category: "meeting",
    eventId: null,
  };
  mockDb.returning.mockReturnValueOnce([{
    id: 1,
    user_id: mockRecord.userId,
    checked_in_at: mockRecord.checkedInAt,
    checked_out_at: null,
    category: mockRecord.category,
    event_id: null,
  }]);

  await repository.createRecord(mockRecord);

  expect(mockDb.values).toHaveBeenCalledWith({
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

    mockTx.limit.mockReturnValueOnce([{ id: 1 }]);

    const updatedRow = {
        id: 1,
        user_id: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        checked_in_at: new Date("2026-10-31T14:00:00Z"),
        checked_out_at: new Date("2026-10-31T17:00:00Z"),
        category: "outreach",
        event_id: 123,
    };
    mockTx.returning.mockReturnValueOnce([updatedRow]);

    const result = await repository.updateLast("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", mockUpdates);

    expect(mockTx.set).toHaveBeenCalledWith({
        checked_out_at: mockUpdates.checkedOutAt,
        category: mockUpdates.category,
        event_id: mockUpdates.eventId,
    });

    expect(result.isOk()).toBe(true);
    const attendance = result._unsafeUnwrap();
    expect(attendance).toEqual({
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

    mockTx.limit.mockReturnValueOnce([{ id: 1 }]);

    const updatedRow = {
        id: 1,
        user_id: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        checked_in_at: new Date("2026-10-31T14:00:00Z"),
        checked_out_at: new Date("2026-10-31T17:00:00Z"),
        category: "meeting",
        event_id: null,
    };
    mockTx.returning.mockReturnValueOnce([updatedRow]);

    const result = await repository.updateLast("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", mockUpdates);

    expect(mockTx.set).toHaveBeenCalledWith({
        checked_out_at: mockUpdates.checkedOutAt,
    });

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

it("should error when no row id is found", async () => {
    const mockUpdates: AttendanceUpdate = {
        checkedOutAt: new Date("2026-10-31T17:00:00Z"),
    };

    mockTx.limit.mockReturnValueOnce([]);

    const result = await repository.updateLast("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", mockUpdates);

    expect(result.isErr()).toBe(true);
});
});


describe("getUserIdByDiscordId", () => {
  it("should return the userId for a given discordId", async () => {
    const mockUserId = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    mockDb.limit.mockReturnValueOnce([{ userId: mockUserId }]);
    const result = await repository.getUserIdByDiscordId("123456789012345678");

    expect(result.isOk()).toBe(true);
    const userId = result._unsafeUnwrap();
    expect(userId).toEqual(mockUserId);

  });
  it("should error when no linked account is found", async () => {
  mockDb.limit.mockReturnValueOnce([]);

  const result = await repository.getUserIdByDiscordId("123456789012345678");

  expect(result.isErr()).toBe(true);
  const error = result._unsafeUnwrapErr();
  expect(error).toBeInstanceOf(Error);
});

  })
})