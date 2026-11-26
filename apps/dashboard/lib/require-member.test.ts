import { getSession } from './auth';
import { requireMember } from './require-member';
import { getMemberProfile } from './roster';

jest.mock('./auth', () => ({ getSession: jest.fn() }));
jest.mock('./roster', () => ({ getMemberProfile: jest.fn() }));
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
});

it('sends signed-out visitors to sign in before loading a profile', async () => {
  (getSession as jest.Mock).mockResolvedValue(null);

  await expect(requireMember()).rejects.toThrow('NEXT_REDIRECT:/auth');
  expect(redirect).toHaveBeenCalledWith('/auth');
  expect(getMemberProfile).not.toHaveBeenCalled();
});

it('sends members without a preferred name to onboarding', async () => {
  (getMemberProfile as jest.Mock).mockResolvedValue({
    name: 'Ada Lovelace',
    preferredName: null,
  });

  await expect(requireMember()).rejects.toThrow('NEXT_REDIRECT:/profile');
  expect(redirect).toHaveBeenCalledWith('/profile');
});

it('treats a missing profile and a blank name as incomplete onboarding', async () => {
  (getMemberProfile as jest.Mock).mockResolvedValueOnce(null);
  await expect(requireMember()).rejects.toThrow('NEXT_REDIRECT:/profile');

  (getMemberProfile as jest.Mock).mockResolvedValueOnce({
    name: 'Ada Lovelace',
    preferredName: '',
  });
  await expect(requireMember()).rejects.toThrow('NEXT_REDIRECT:/profile');
  expect(redirect).toHaveBeenCalledWith('/profile');
});

it('leaves a profile API failure in place so the page does not continue', async () => {
  (getMemberProfile as jest.Mock).mockRejectedValue(
    new Error('Could not load member profile (503)'),
  );

  await expect(requireMember()).rejects.toThrow('Could not load member profile (503)');
  expect(redirect).not.toHaveBeenCalled();
});

it('returns the session and saved preferred name', async () => {
  await expect(requireMember()).resolves.toEqual({
    session,
    profile: { name: 'Ada Lovelace', preferredName: 'Sam Rivers' },
  });
});
