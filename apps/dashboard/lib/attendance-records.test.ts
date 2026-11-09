import { dayBoundary, getAttendanceRecords, recordQuery } from './attendance-records';

jest.mock('next/headers', () => ({ headers: jest.fn() }));

import { headers } from 'next/headers';

const list = {
  records: [
    {
      id: 7,
      userId: 'student-1',
      memberName: 'Ada Lovelace',
      memberImage: null,
      eventId: null,
      eventName: null,
      category: 'meeting',
      status: 'excused',
      checkedInAt: '2026-11-07T14:00:00.000Z',
      checkedOutAt: '2026-11-07T18:00:00.000Z',
      hours: 4,
      edited: false,
    },
  ],
  truncated: false,
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

describe('dayBoundary', () => {
  it('uses the team time zone, including daylight saving changes', () => {
    expect(dayBoundary('2026-11-07', 'start')?.toISOString()).toBe('2026-11-07T05:00:00.000Z');
    expect(dayBoundary('2026-11-07', 'end')?.toISOString()).toBe('2026-11-08T04:59:59.999Z');
    expect(dayBoundary('2026-11-01', 'start')?.toISOString()).toBe('2026-11-01T04:00:00.000Z');
    expect(dayBoundary('2026-03-08', 'end')?.toISOString()).toBe('2026-03-09T03:59:59.999Z');
  });

  it('ignores values that are not calendar dates', () => {
    expect(dayBoundary('last week', 'start')).toBeNull();
  });
});

it('turns page filters into API query parameters', () => {
  expect(
    Object.fromEntries(
      recordQuery({ q: ' ada ', from: '2026-11-01', to: '2026-11-07', status: 'excused' }),
    ),
  ).toEqual({
    q: 'ada',
    from: '2026-11-01T04:00:00.000Z',
    to: '2026-11-08T04:59:59.999Z',
    status: 'excused',
  });
  expect(recordQuery({ q: '  ', from: 'bad', status: 'deleted' }).toString()).toBe('');
});

it('returns null without calling the API when the browser has no session cookie', async () => {
  mockCookie();
  global.fetch = jest.fn();

  await expect(getAttendanceRecords({})).resolves.toBeNull();
  expect(global.fetch).not.toHaveBeenCalled();
});

it('forwards the session cookie and filters and returns the records', async () => {
  global.fetch = jest.fn().mockResolvedValue(jsonResponse(list));

  await expect(getAttendanceRecords({ status: 'excused' })).resolves.toEqual(list);
  expect(global.fetch).toHaveBeenCalledWith(
    'http://localhost:8000/api/attendance/records?status=excused',
    expect.objectContaining({
      headers: { cookie: 'better-auth.session_token=valid' },
      cache: 'no-store',
    }),
  );
});

it('reports when the member is not allowed to manage attendance', async () => {
  global.fetch = jest.fn().mockResolvedValue(jsonResponse({}, 403));

  await expect(getAttendanceRecords({})).resolves.toBe('forbidden');
  expect(global.fetch).toHaveBeenCalledWith(
    'http://localhost:8000/api/attendance/records',
    expect.anything(),
  );
});

it('returns null when the API fails or is unreachable', async () => {
  const error = new TypeError('fetch failed');
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce(jsonResponse({}, 500))
    .mockRejectedValueOnce(error);

  await expect(getAttendanceRecords({})).resolves.toBeNull();
  await expect(getAttendanceRecords({})).resolves.toBeNull();
  expect(consoleError).toHaveBeenCalledWith('Failed to load attendance records:', error);
});
