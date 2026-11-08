import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventsController } from './events.controller.js';

const events = {
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  cancel: vi.fn(),
};
const request = { authUserId: 'user-1' } as never;
const anonymousRequest = {} as never;

function makeController() {
  return new EventsController(events as never);
}

describe('EventsController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists events for any signed-in member', async () => {
    events.list.mockResolvedValue([event]);
    await expect(makeController().list()).resolves.toEqual([event]);
  });

  it('passes the authenticated user identity into create, update, and cancel actions', async () => {
    const input = {
      seasonId: 4,
      name: event.name,
      location: event.location,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      eventType: 'meeting' as const,
      hourCategory: 'meeting' as const,
    };
    events.create.mockResolvedValue(event);
    events.update.mockResolvedValue(event);
    events.cancel.mockResolvedValue({ ...event, status: 'cancelled' });

    await expect(makeController().create(request, input)).resolves.toEqual(event);
    await expect(makeController().update(request, 7, { name: 'Renamed' })).resolves.toEqual(event);
    await expect(makeController().cancel(request, 7)).resolves.toMatchObject({
      status: 'cancelled',
    });
    expect(events.create).toHaveBeenCalledWith(input, 'user-1');
    expect(events.update).toHaveBeenCalledWith(7, { name: 'Renamed' }, 'user-1');
    expect(events.cancel).toHaveBeenCalledWith(7, 'user-1');
  });

  it('rejects write actions when the session guard did not attach a user', async () => {
    await expect(makeController().cancel(anonymousRequest, 7)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(events.cancel).not.toHaveBeenCalled();
  });
});

const event = {
  id: 7,
  seasonId: 4,
  name: 'Weekly build meeting',
  location: 'Robotics lab',
  startsAt: '2026-11-10T21:30:00.000Z',
  endsAt: '2026-11-11T00:00:00.000Z',
  status: 'scheduled',
};
