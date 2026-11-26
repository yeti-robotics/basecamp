import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { getSession } from '../../lib/auth';
import { getMemberProfile, getRosterView } from '../../lib/roster';
import RosterPage from './page';

jest.mock('../../lib/auth', () => ({ getSession: jest.fn() }));
jest.mock('../../lib/roster', () => ({
  getMemberProfile: jest.fn(),
  getRosterView: jest.fn(),
}));
jest.mock('./RosterTable', () => ({
  RosterTable: () => <h1>Roster</h1>,
}));
jest.mock('next/navigation', () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

import { redirect } from 'next/navigation';

const session = {
  user: { id: 'user-1', name: 'Ada Lovelace', email: 'ada@example.com', image: null },
  session: { id: 'session-1', expiresAt: '2026-12-01T00:00:00.000Z' },
};

beforeEach(() => {
  jest.clearAllMocks();
  (getSession as jest.Mock).mockResolvedValue(session);
  (getMemberProfile as jest.Mock).mockResolvedValue({
    name: 'Ada Lovelace',
    preferredName: 'Sam Rivers',
  });
  (getRosterView as jest.Mock).mockResolvedValue({
    season: { id: 1, name: '2026–27', startsOn: '2026-05-15', endsOn: '2027-05-14' },
    members: [],
    canManage: false,
    seasons: [],
    ownMember: {
      id: 5,
      userId: 'user-1',
      name: '',
      image: null,
      role: 'student',
      studentExperience: 'rookie',
      state: 'active',
    },
  });
});

it('sends members without a preferred name to onboarding before loading the roster', async () => {
  (getMemberProfile as jest.Mock).mockResolvedValue({ name: 'Ada Lovelace', preferredName: null });

  await expect(RosterPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
    'NEXT_REDIRECT:/profile',
  );
  expect(redirect).toHaveBeenCalledWith('/profile');
  expect(getRosterView).not.toHaveBeenCalled();
});

it('uses the roster response and does not request the profile again', async () => {
  render(await RosterPage({ searchParams: Promise.resolve({}) }));

  expect(screen.getByRole('heading', { name: 'Roster' })).toBeInTheDocument();
  expect(getMemberProfile).toHaveBeenCalledTimes(1);
});
