import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SeasonsController } from './seasons.controller.js';

const memberContext = { authenticate: vi.fn() };

const seasons = {
  viewFor: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};
const request = { headers: { cookie: 'basecamp-session=test' } } as never;

function makeController() {
  return new SeasonsController(memberContext as never, seasons as never);
}

describe('SeasonsController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    memberContext.authenticate.mockResolvedValue('user-1');
  });

  it('requires an authenticated session to read seasons', async () => {
    memberContext.authenticate.mockRejectedValue(new UnauthorizedException());
    await expect(makeController().list(request)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns season list and read/manage permissions for the signed-in member', async () => {
    const result = { seasons: [season], canManage: false, canBootstrap: false, currentSeasonId: 4 };
    seasons.viewFor.mockResolvedValue(result);
    await expect(makeController().list(request)).resolves.toEqual(result);
    expect(seasons.viewFor).toHaveBeenCalledWith('user-1');
  });

  it('passes authenticated user identity into create and update actions', async () => {
    const input = { name: '2027–28', startsOn: '2027-05-15', endsOn: '2028-05-14' };
    seasons.create.mockResolvedValue(season);
    seasons.update.mockResolvedValue(season);
    await expect(makeController().create(request, input)).resolves.toEqual(season);
    await expect(makeController().update(request, 4, input)).resolves.toEqual(season);
    expect(seasons.create).toHaveBeenCalledWith(input, 'user-1');
    expect(seasons.update).toHaveBeenCalledWith(4, input, 'user-1');
  });

  it('does not require a season membership to reach the first-season bootstrap action', async () => {
    memberContext.authenticate.mockResolvedValue('bootstrap-user');
    seasons.create.mockResolvedValue(season);
    await expect(
      makeController().create(request, {
        name: season.name,
        startsOn: season.startsOn,
        endsOn: season.endsOn,
      }),
    ).resolves.toEqual(season);
    expect(seasons.create).toHaveBeenCalledWith(
      { name: season.name, startsOn: season.startsOn, endsOn: season.endsOn },
      'bootstrap-user',
    );
  });
});

const season = { id: 4, name: '2027–28', startsOn: '2027-05-15', endsOn: '2028-05-14' };
