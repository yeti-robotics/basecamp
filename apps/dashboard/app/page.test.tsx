import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { getAttendanceOverview } from '../lib/attendance';
import { getSession } from '../lib/auth';
import { getMemberProfile } from '../lib/roster';
import HomePage from './page';

jest.mock('../lib/attendance', () => ({ getAttendanceOverview: jest.fn() }));
jest.mock('../lib/auth', () => ({ getSession: jest.fn() }));
jest.mock('../lib/roster', () => ({ getMemberProfile: jest.fn() }));
jest.mock('./DashboardOverview', () => ({
  DashboardOverview: ({ user }: { user: { name: string } }) => <h1>{user.name}</h1>,
}));
jest.mock('next/navigation', () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

import { redirect } from 'next/navigation';

const session = {
  user: { id: 'user-1', name: 'Ada Lovelace', email: 'ada@example.com' },
  session: { id: 'session-1', expiresAt: '2026-12-01T00:00:00.000Z' },
};

beforeEach(() => {
  jest.clearAllMocks();
  (getSession as jest.Mock).mockResolvedValue(session);
  (getMemberProfile as jest.Mock).mockResolvedValue({
    name: 'Ada Lovelace',
    preferredName: 'Sam Rivers',
  });
  (getAttendanceOverview as jest.Mock).mockResolvedValue(null);
});

it('sends signed-out visitors to sign in', async () => {
  (getSession as jest.Mock).mockResolvedValue(null);

  await expect(HomePage()).rejects.toThrow('NEXT_REDIRECT:/auth');
  expect(getMemberProfile).not.toHaveBeenCalled();
  expect(getAttendanceOverview).not.toHaveBeenCalled();
});

it('sends members without a preferred name to onboarding', async () => {
  (getMemberProfile as jest.Mock).mockResolvedValue({ name: 'Ada Lovelace', preferredName: null });

  await expect(HomePage()).rejects.toThrow('NEXT_REDIRECT:/profile');
  expect(redirect).toHaveBeenCalledWith('/profile');
  expect(getAttendanceOverview).not.toHaveBeenCalled();
});

it('does not open the dashboard when the profile API fails', async () => {
  (getMemberProfile as jest.Mock).mockRejectedValue(
    new Error('Could not load member profile (503)'),
  );

  await expect(HomePage()).rejects.toThrow('Could not load member profile (503)');
  expect(redirect).not.toHaveBeenCalled();
  expect(getAttendanceOverview).not.toHaveBeenCalled();
});

it('shows the preferred name on the dashboard', async () => {
  render(await HomePage());

  expect(screen.getByRole('heading', { name: 'Sam Rivers' })).toBeInTheDocument();
  expect(getAttendanceOverview).toHaveBeenCalled();
});
