import { getEvents } from './events';

jest.mock('next/headers', () => ({ headers: jest.fn() }));

import { headers } from 'next/headers';

const event = {
  id: 7,
  seasonId: 4,
  seasonName: '2026–27',
  name: 'Weekly build meeting',
  description: null,
  location: 'Robotics lab',
  startsAt: '2026-11-10T21:30:00.000Z',
  endsAt: '2026-11-11T00:00:00.000Z',
  eventType: 'meeting',
  hourCategory: 'meeting',
  status: 'scheduled',
};

function mockCookie(cookie?: string) {
  (headers as jest.Mock).mockResolvedValue(new Headers(cookie ? { cookie } : undefined));
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

beforeEach(() => {
  mockCookie('better-auth.session_token=valid');
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('returns null without calling the API when the browser has no session cookie', async () => {
  mockCookie();
  global.fetch = jest.fn();

  await expect(getEvents()).resolves.toBeNull();
  expect(global.fetch).not.toHaveBeenCalled();
});

it('forwards the session cookie and returns the events', async () => {
  global.fetch = jest.fn().mockResolvedValue(jsonResponse([event]));

  await expect(getEvents()).resolves.toEqual([event]);
  expect(global.fetch).toHaveBeenCalledWith(
    'http://localhost:8000/api/events',
    expect.objectContaining({
      headers: { cookie: 'better-auth.session_token=valid' },
      cache: 'no-store',
    }),
  );
});

it('returns null when the API rejects the request', async () => {
  global.fetch = jest.fn().mockResolvedValue(jsonResponse({ message: 'Unauthorized' }, 401));

  await expect(getEvents()).resolves.toBeNull();
});

it('returns null and logs when the API is unreachable', async () => {
  const error = new TypeError('fetch failed');
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  global.fetch = jest.fn().mockRejectedValue(error);

  await expect(getEvents()).resolves.toBeNull();
  expect(consoleError).toHaveBeenCalledWith('Failed to load events:', error);
});
