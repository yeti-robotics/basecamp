import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RosterController } from './roster.controller.js';

const memberContext = { authenticate: vi.fn() };
const authorization = { accessFor: vi.fn() };
const roster = {
  currentRoster: vi.fn(),
  listSeasons: vi.fn(),
  seasonRoster: vi.fn(),
  getOwnCurrent: vi.fn(),
};
const request = { headers: { cookie: 'session=test' } } as never;
const current = {
  season: { id: 3, name: '2026–27', startsOn: '2026-05-15', endsOn: '2027-05-14' },
  members: [
    {
      id: 5,
      userId: 'member-1',
      name: 'Alex Member',
      role: 'student',
      studentExperience: 'veteran',
    },
  ],
};

function makeController() {
  return new RosterController(memberContext as never, authorization as never, roster as never);
}

describe('RosterController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    memberContext.authenticate.mockResolvedValue('member-1');
    authorization.accessFor.mockResolvedValue({
      canView: true,
      canManage: false,
      canBootstrap: false,
    });
    roster.currentRoster.mockResolvedValue(current);
    roster.listSeasons.mockResolvedValue([]);
    roster.seasonRoster.mockResolvedValue({ season: current.season, members: current.members });
    roster.getOwnCurrent.mockResolvedValue({
      id: 5,
      user_id: 'member-1',
      role: 'student',
      student_experience: 'veteran',
      state: 'active',
      joined_at: new Date('2026-05-15T12:00:00.000Z'),
      removed_at: null,
    });
  });

  it('allows a Mentor to read the current roster', async () => {
    await expect(makeController().current(request, 'false')).resolves.toEqual({
      ...current,
      canManage: false,
      seasons: [],
    });
    expect(roster.currentRoster).toHaveBeenCalledWith(false);
  });

  it('allows only a Team Admin to read past rosters', async () => {
    authorization.accessFor.mockResolvedValue({
      canView: true,
      canManage: false,
      canBootstrap: false,
    });
    await expect(makeController().season(request, 2)).rejects.toBeInstanceOf(ForbiddenException);
    authorization.accessFor.mockResolvedValue({
      canView: true,
      canManage: true,
      canBootstrap: false,
    });
    await expect(makeController().season(request, 2)).resolves.toEqual({
      season: current.season,
      members: current.members,
    });
  });

  it('prevents Students and Student Leaders from enumerating the roster', async () => {
    authorization.accessFor.mockResolvedValue({
      canView: false,
      canManage: false,
      canBootstrap: false,
    });
    await expect(makeController().current(request, 'false')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(roster.currentRoster).not.toHaveBeenCalled();
  });

  it('lets a member read only their own current assignment', async () => {
    await expect(makeController().me(request)).resolves.toEqual({
      id: 5,
      userId: 'member-1',
      role: 'student',
      studentExperience: 'veteran',
      state: 'active',
      joinedAt: new Date('2026-05-15T12:00:00.000Z'),
      removedAt: null,
    });
    expect(roster.getOwnCurrent).toHaveBeenCalledWith('member-1', expect.any(Date));
  });

  it('does not include removed members unless a Team Admin explicitly requests them', async () => {
    authorization.accessFor.mockResolvedValue({
      canView: true,
      canManage: false,
      canBootstrap: false,
    });
    await expect(makeController().current(request, 'true')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    authorization.accessFor.mockResolvedValue({
      canView: true,
      canManage: true,
      canBootstrap: false,
    });
    await makeController().current(request, 'true');
    expect(roster.currentRoster).toHaveBeenLastCalledWith(true);
  });

  it('returns an empty roster when the current season has no members', async () => {
    roster.currentRoster.mockResolvedValue({ season: current.season, members: [] });
    await expect(makeController().current(request, 'false')).resolves.toMatchObject({
      members: [],
    });
  });
});
