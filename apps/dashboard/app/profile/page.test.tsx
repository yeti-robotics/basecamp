import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { getSession } from '../../lib/auth';
import { getMemberProfile } from '../../lib/roster';
import ProfilePage from './page';

jest.mock('../../lib/auth', () => ({ getSession: jest.fn() }));
jest.mock('../../lib/roster', () => ({ getMemberProfile: jest.fn() }));
jest.mock('next/navigation', () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn() }),
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
    preferredName: null,
  });
});

it('sends signed-out visitors to sign in', async () => {
  (getSession as jest.Mock).mockResolvedValue(null);

  await expect(ProfilePage()).rejects.toThrow('NEXT_REDIRECT:/auth');
  expect(redirect).toHaveBeenCalledWith('/auth');
  expect(getMemberProfile).not.toHaveBeenCalled();
});

it('keeps a member with no saved name on the onboarding form', async () => {
  render(await ProfilePage());

  expect(screen.getByText('What should we call you?')).toBeInTheDocument();
  expect(redirect).not.toHaveBeenCalled();
});

it('keeps a missing profile on the onboarding form', async () => {
  (getMemberProfile as jest.Mock).mockResolvedValue(null);

  render(await ProfilePage());

  expect(screen.getByText('What should we call you?')).toBeInTheDocument();
  expect(redirect).not.toHaveBeenCalled();
});

it('shows the saved name for editing', async () => {
  (getMemberProfile as jest.Mock).mockResolvedValue({
    name: 'Ada Lovelace',
    preferredName: 'Sam Rivers',
  });

  render(await ProfilePage());

  expect(screen.getByRole('textbox', { name: 'Preferred name' })).toHaveValue('Sam Rivers');
  expect(screen.getByRole('link', { name: 'Back to dashboard' })).toBeInTheDocument();
});

it('does not render the form when the profile API fails', async () => {
  (getMemberProfile as jest.Mock).mockRejectedValue(
    new Error('Could not load member profile (503)'),
  );

  await expect(ProfilePage()).rejects.toThrow('Could not load member profile (503)');
  expect(redirect).not.toHaveBeenCalled();
});
