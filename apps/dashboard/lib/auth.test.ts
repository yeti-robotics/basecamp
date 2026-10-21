import { getSession } from './auth';

jest.mock('next/headers', () => ({ headers: jest.fn() }));

import { headers } from 'next/headers';

const session = {
  user: { id: 'user-1', name: 'Ada', email: 'ada@example.com' },
  session: { id: 'session-1', expiresAt: '2026-12-01T00:00:00.000Z' },
};

function mockCookie(cookie?: string) {
  (headers as jest.Mock).mockResolvedValue(new Headers(cookie ? { cookie } : undefined));
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

beforeEach(() => {
  jest.useRealTimers();
  mockCookie('better-auth.session_token=valid');
});

afterEach(() => {
  jest.useRealTimers();
});

it('returns null without calling the API when the browser has no session cookie', async () => {
  mockCookie();
  global.fetch = jest.fn();

  await expect(getSession()).resolves.toBeNull();
  expect(global.fetch).not.toHaveBeenCalled();
});

it('returns null when the API confirms there is no session', async () => {
  global.fetch = jest.fn().mockResolvedValue(jsonResponse(null));

  await expect(getSession()).resolves.toBeNull();
});

it('returns the session when the API is up', async () => {
  global.fetch = jest.fn().mockResolvedValue(jsonResponse(session));

  await expect(getSession()).resolves.toEqual(session);
  expect(global.fetch).toHaveBeenCalledWith(
    'http://localhost:8000/api/auth/get-session',
    expect.objectContaining({
      headers: { cookie: 'better-auth.session_token=valid' },
      cache: 'no-store',
    }),
  );
});

it('waits through an API restart and then returns the existing session', async () => {
  jest.useFakeTimers();
  global.fetch = jest
    .fn()
    .mockRejectedValueOnce(new TypeError('fetch failed'))
    .mockResolvedValueOnce(jsonResponse(session));

  const pending = getSession();
  await jest.advanceTimersByTimeAsync(200);

  await expect(pending).resolves.toEqual(session);
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

it('retries a restart status and does not report the member as signed out', async () => {
  jest.useFakeTimers();
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce(jsonResponse({ message: 'starting' }, 503))
    .mockResolvedValueOnce(jsonResponse(session));

  const pending = getSession();
  await jest.advanceTimersByTimeAsync(200);

  await expect(pending).resolves.toEqual(session);
});

it('reports a definitive API rejection without waiting for a restart', async () => {
  global.fetch = jest.fn().mockResolvedValue(jsonResponse({ message: 'nope' }, 401));

  await expect(getSession()).rejects.toThrow('Session check failed (401)');
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

it('fails the page instead of sending a still-valid session to sign-in', async () => {
  jest.useFakeTimers();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed'));

  const pending = getSession();
  const assertion = expect(pending).rejects.toThrow(/session check failed/i);
  await jest.advanceTimersByTimeAsync(10_000);

  await assertion;
});
