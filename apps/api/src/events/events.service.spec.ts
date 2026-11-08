import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventsService } from './events.service.js';

function selectQuery(rows: unknown[]) {
  const builder = {
    from: vi.fn(() => builder),
    innerJoin: vi.fn(() => builder),
    where: vi.fn(() => builder),
    orderBy: vi.fn().mockResolvedValue(rows),
    limit: vi.fn().mockResolvedValue(rows),
  };
  return builder;
}

function insertQuery(rows: unknown[]) {
  const builder = {
    values: vi.fn(() => builder),
    returning: vi.fn().mockResolvedValue(rows),
  };
  return builder;
}

function updateQuery(rows: unknown[] = []) {
  const builder = {
    set: vi.fn(() => builder),
    where: vi.fn(() => builder),
    returning: vi.fn().mockResolvedValue(rows),
  };
  return builder;
}

const database = { select: vi.fn(), insert: vi.fn(), update: vi.fn() };
const authorization = { accessFor: vi.fn() };

const input = {
  seasonId: 4,
  name: '  Weekly build meeting ',
  description: '  Drivetrain assembly ',
  location: ' Robotics lab ',
  startsAt: '2026-11-10T21:30:00.000Z',
  endsAt: '2026-11-11T00:00:00.000Z',
  eventType: 'meeting' as const,
  hourCategory: 'meeting' as const,
};

const event = {
  id: 7,
  seasonId: 4,
  seasonName: '2026–27',
  name: 'Weekly build meeting',
  description: 'Drivetrain assembly',
  location: 'Robotics lab',
  startsAt: new Date(input.startsAt),
  endsAt: new Date(input.endsAt),
  eventType: 'meeting',
  hourCategory: 'meeting',
  status: 'scheduled',
};

const storedEvent = {
  id: 7,
  season_id: 4,
  name: 'Weekly build meeting',
  description: null,
  location: 'Robotics lab',
  starts_at: new Date(input.startsAt),
  ends_at: new Date(input.endsAt),
  event_type: 'meeting',
  hour_category: 'meeting',
  status: 'scheduled',
};

function makeService() {
  return new EventsService({ db: database } as never, authorization as never);
}

describe('EventsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorization.accessFor.mockResolvedValue({ canManage: true, canView: true });
  });

  it('lists events with their season names in start order', async () => {
    const query = selectQuery([event]);
    database.select.mockReturnValueOnce(query);

    await expect(makeService().list()).resolves.toEqual([event]);
    expect(query.innerJoin).toHaveBeenCalledOnce();
    expect(query.orderBy).toHaveBeenCalledOnce();
  });

  describe('create', () => {
    it('rejects members without Team Admin access before touching the database', async () => {
      authorization.accessFor.mockResolvedValue({ canManage: false, canView: true });

      await expect(makeService().create(input, 'member')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(authorization.accessFor).toHaveBeenCalledWith('member');
      expect(database.select).not.toHaveBeenCalled();
      expect(database.insert).not.toHaveBeenCalled();
    });

    it.each([
      ['missing details', null, 'Event details are required'],
      ['an invalid season', { ...input, seasonId: 0 }, 'Choose a valid season'],
      ['a blank name', { ...input, name: '   ' }, 'Name is required'],
      ['a blank location', { ...input, location: '' }, 'Location is required'],
      ['a non-text description', { ...input, description: 5 }, 'Description must be text'],
      ['a missing start time', { ...input, startsAt: undefined }, 'Start time is required'],
      [
        'an invalid end time',
        { ...input, endsAt: 'not a date' },
        'End time must be a valid timestamp',
      ],
      [
        'an end before the start',
        { ...input, endsAt: input.startsAt },
        'End time must be after start time',
      ],
      ['an unknown event type', { ...input, eventType: 'party' }, 'Choose a valid event type'],
      [
        'an unknown hour category',
        { ...input, hourCategory: 'bonus' },
        'Choose a valid hour contribution',
      ],
    ])('rejects %s', async (_case, body, message) => {
      const result = makeService().create(body as never, 'admin');

      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      await expect(result).rejects.toThrow(message);
      expect(database.insert).not.toHaveBeenCalled();
    });

    it('rejects a season that does not exist', async () => {
      database.select.mockReturnValueOnce(selectQuery([]));

      await expect(makeService().create(input, 'admin')).rejects.toThrow('Season not found');
      expect(database.insert).not.toHaveBeenCalled();
    });

    it('stores trimmed details with the creating admin and returns the saved event', async () => {
      const insert = insertQuery([{ id: 7 }]);
      database.select
        .mockReturnValueOnce(selectQuery([{ id: 4 }]))
        .mockReturnValueOnce(selectQuery([event]));
      database.insert.mockReturnValueOnce(insert);

      await expect(makeService().create(input, 'admin')).resolves.toEqual(event);
      expect(insert.values).toHaveBeenCalledWith({
        season_id: 4,
        name: 'Weekly build meeting',
        description: 'Drivetrain assembly',
        location: 'Robotics lab',
        starts_at: new Date(input.startsAt),
        ends_at: new Date(input.endsAt),
        event_type: 'meeting',
        hour_category: 'meeting',
        created_by: 'admin',
      });
    });

    it('stores a blank description as null', async () => {
      const insert = insertQuery([{ id: 7 }]);
      database.select
        .mockReturnValueOnce(selectQuery([{ id: 4 }]))
        .mockReturnValueOnce(selectQuery([event]));
      database.insert.mockReturnValueOnce(insert);

      await makeService().create({ ...input, description: '   ' }, 'admin');
      expect(insert.values).toHaveBeenCalledWith(expect.objectContaining({ description: null }));
    });

    it('fails loudly when the insert does not return a row', async () => {
      database.select.mockReturnValueOnce(selectQuery([{ id: 4 }]));
      database.insert.mockReturnValueOnce(insertQuery([]));

      await expect(makeService().create(input, 'admin')).rejects.toThrow(
        'Event insert did not return a row',
      );
    });
  });

  describe('update', () => {
    it('rejects members without Team Admin access', async () => {
      authorization.accessFor.mockResolvedValue({ canManage: false, canView: true });

      await expect(makeService().update(7, { name: 'Renamed' }, 'member')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(database.update).not.toHaveBeenCalled();
    });

    it('returns not found for an unknown event', async () => {
      database.select.mockReturnValueOnce(selectQuery([]));

      await expect(makeService().update(99, { name: 'Renamed' }, 'admin')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(database.update).not.toHaveBeenCalled();
    });

    it('rejects an empty set of changes', async () => {
      database.select
        .mockReturnValueOnce(selectQuery([storedEvent]))
        .mockReturnValueOnce(selectQuery([storedEvent]));

      await expect(makeService().update(7, {}, 'admin')).rejects.toThrow(
        'Event changes are required',
      );
      await expect(makeService().update(7, null as never, 'admin')).rejects.toThrow(
        'Event changes are required',
      );
    });

    it('checks a new end time against the stored start time', async () => {
      database.select.mockReturnValueOnce(selectQuery([storedEvent]));

      await expect(
        makeService().update(7, { endsAt: '2026-11-10T20:00:00.000Z' }, 'admin'),
      ).rejects.toThrow('End time must be after start time');
      expect(database.update).not.toHaveBeenCalled();
    });

    it.each([
      ['event type', { eventType: 'party' }, 'Choose a valid event type'],
      ['hour category', { hourCategory: 'bonus' }, 'Choose a valid hour contribution'],
    ])('rejects an unknown %s', async (_field, body, message) => {
      database.select.mockReturnValueOnce(selectQuery([storedEvent]));

      await expect(makeService().update(7, body as never, 'admin')).rejects.toThrow(message);
    });

    it('rejects moving the event to a season that does not exist', async () => {
      database.select
        .mockReturnValueOnce(selectQuery([storedEvent]))
        .mockReturnValueOnce(selectQuery([]));

      await expect(makeService().update(7, { seasonId: 5 }, 'admin')).rejects.toThrow(
        'Season not found',
      );
      expect(database.update).not.toHaveBeenCalled();
    });

    it('writes only the changed fields and returns the updated event', async () => {
      const update = updateQuery();
      database.select
        .mockReturnValueOnce(selectQuery([storedEvent]))
        .mockReturnValueOnce(selectQuery([{ id: 5 }]))
        .mockReturnValueOnce(selectQuery([event]));
      database.update.mockReturnValueOnce(update);

      await expect(
        makeService().update(
          7,
          {
            seasonId: 5,
            name: ' Saturday build ',
            description: null,
            location: 'Cafeteria',
            eventType: 'extra_meeting',
            hourCategory: 'none',
            startsAt: '2026-11-21T14:00:00.000Z',
            endsAt: '2026-11-21T18:00:00.000Z',
          },
          'admin',
        ),
      ).resolves.toEqual(event);
      expect(update.set).toHaveBeenCalledWith({
        season_id: 5,
        name: 'Saturday build',
        description: null,
        location: 'Cafeteria',
        event_type: 'extra_meeting',
        hour_category: 'none',
        starts_at: new Date('2026-11-21T14:00:00.000Z'),
        ends_at: new Date('2026-11-21T18:00:00.000Z'),
        updated_at: expect.any(Date),
      });
    });
  });

  describe('cancel', () => {
    it('rejects members without Team Admin access', async () => {
      authorization.accessFor.mockResolvedValue({ canManage: false, canView: true });

      await expect(makeService().cancel(7, 'member')).rejects.toBeInstanceOf(ForbiddenException);
      expect(database.update).not.toHaveBeenCalled();
    });

    it('returns not found when no event was cancelled', async () => {
      database.update.mockReturnValueOnce(updateQuery([]));

      await expect(makeService().cancel(99, 'admin')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('marks the event cancelled and returns it', async () => {
      const update = updateQuery([{ id: 7 }]);
      const cancelled = { ...event, status: 'cancelled' };
      database.update.mockReturnValueOnce(update);
      database.select.mockReturnValueOnce(selectQuery([cancelled]));

      await expect(makeService().cancel(7, 'admin')).resolves.toEqual(cancelled);
      expect(update.set).toHaveBeenCalledWith({
        status: 'cancelled',
        updated_at: expect.any(Date),
      });
    });
  });
});
