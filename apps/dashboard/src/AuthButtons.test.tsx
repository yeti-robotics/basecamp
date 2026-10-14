import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SignInForm } from '../app/auth/components/SignInForm';
import { SignOutButton } from '../app/SignOutButton';
import { authClient } from '../lib/auth-client';
import { navigateAfterAuth } from '../lib/auth-navigation';

jest.mock('../lib/auth-client', () => ({
  authClient: { signIn: { social: jest.fn() }, signOut: jest.fn() },
}));
jest.mock('../lib/auth-navigation', () => ({ navigateAfterAuth: jest.fn() }));
const social = jest.mocked(authClient.signIn.social);
const signOut = jest.mocked(authClient.signOut);
const navigate = jest.mocked(navigateAfterAuth);

beforeEach(() => jest.clearAllMocks());

it('explicitly navigates to the Discord authorization URL after starting sign-in', async () => {
  social.mockResolvedValue({
    data: { url: 'https://discord.com/oauth2/authorize', redirect: false },
    error: null,
  } as Awaited<ReturnType<typeof social>>);
  render(<SignInForm redirectUrl="/" />);
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with Discord' }));
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith('https://discord.com/oauth2/authorize'),
  );
  expect(social).toHaveBeenCalledWith({
    provider: 'discord',
    callbackURL: '/',
    errorCallbackURL: '/auth?error=oauth',
    disableRedirect: true,
  });
});

it('shows sign-in errors and enables retry instead of leaving the button stuck', async () => {
  social.mockResolvedValue({ data: null, error: { message: 'Discord unavailable' } } as Awaited<
    ReturnType<typeof social>
  >);
  render(<SignInForm />);
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with Discord' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Discord unavailable');
  expect(screen.getByRole('button', { name: 'Sign in with Discord' })).toBeEnabled();
  expect(navigate).not.toHaveBeenCalled();
});

it('shows an error if a sign-in response has no authorization URL', async () => {
  social.mockResolvedValue({ data: null, error: null } as unknown as Awaited<
    ReturnType<typeof social>
  >);
  render(<SignInForm />);
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with Discord' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be started');
  expect(navigate).not.toHaveBeenCalled();
});

it('shows navigation failures instead of silently leaving sign-in pending', async () => {
  social.mockResolvedValue({
    data: { url: 'https://discord.com/oauth2/authorize', redirect: false },
    error: null,
  } as Awaited<ReturnType<typeof social>>);
  navigate.mockImplementationOnce(() => {
    throw new Error('Navigation blocked');
  });
  render(<SignInForm />);
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with Discord' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Navigation blocked');
  expect(screen.getByRole('button', { name: 'Sign in with Discord' })).toBeEnabled();
});

it('rejects external callback paths', async () => {
  social.mockResolvedValue({
    data: { url: 'https://discord.com/oauth2/authorize', redirect: false },
    error: null,
  } as Awaited<ReturnType<typeof social>>);
  render(<SignInForm redirectUrl="/\\external.example" />);
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with Discord' }));
  await waitFor(() =>
    expect(social).toHaveBeenCalledWith(expect.objectContaining({ callbackURL: '/' })),
  );
});

it('redirects to the sign-in page only after successful sign-out', async () => {
  signOut.mockResolvedValue({ data: { success: true }, error: null } as Awaited<
    ReturnType<typeof signOut>
  >);
  render(<SignOutButton />);
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/auth'));
});

it('shows sign-out errors and enables retry', async () => {
  signOut.mockResolvedValue({ data: null, error: { message: 'Sign out unavailable' } } as Awaited<
    ReturnType<typeof signOut>
  >);
  render(<SignOutButton />);
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Sign out unavailable');
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled();
  expect(navigate).not.toHaveBeenCalled();
});
