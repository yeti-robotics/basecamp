import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { getAttendanceRecords } from '../../lib/attendance-records';
import { getSession } from '../../lib/auth';
import { getEvents } from '../../lib/events';
import { getRosterView } from '../../lib/roster';
import AttendancePage from './page';

jest.mock('../../lib/auth', () => ({ getSession: jest.fn() }));
jest.mock('../../lib/attendance-records', () => ({ getAttendanceRecords: jest.fn() }));
jest.mock('../../lib/events', () => ({ getEvents: jest.fn() }));
jest.mock('../../lib/roster', () => ({ getRosterView: jest.fn() }));
jest.mock('next/navigation', () => ({
  redirect: jest.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
  useRouter: () => ({ refresh: jest.fn() }),
}));

import { redirect } from 'next/navigation';

const session = {
  user: { id: 'mentor-1', name: 'Mia Mentor', email: 'mia@example.com' },
  session: { id: 'session-1', expiresAt: '2026-12-01T00:00:00.000Z' },
};
const record = {
  id: 7,
  userId: 'student-1',
  memberName: 'Ada Lovelace',
  memberImage: null,
  eventId: null,
  eventName: null,
  category: 'meeting',
  status: 'normal',
  checkedInAt: '2026-11-05T21:30:00.000Z',
  checkedOutAt: '2026-11-05T23:45:00.000Z',
  hours: 2.25,
  edited: false,
};
const member = (userId: string, name: string, state = 'active') => ({
  id: 1,
  userId,
  name,
  image: null,
  role: 'student',
  studentExperience: 'rookie',
  state,
});

function searchParams(params: Record<string, string | string[]> = {}) {
  return Promise.resolve(params) as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  (getSession as jest.Mock).mockResolvedValue(session);
  (getAttendanceRecords as jest.Mock).mockResolvedValue({ records: [record], truncated: false });
  (getEvents as jest.Mock).mockResolvedValue([]);
  (getRosterView as jest.Mock).mockResolvedValue({
    members: [
      member('student-2', 'Grace Hopper'),
      member('student-1', 'Ada Lovelace'),
      member('student-3', 'Removed Member', 'removed'),
    ],
  });
});

it('redirects to sign-in without a session', async () => {
  (getSession as jest.Mock).mockResolvedValue(null);

  await expect(AttendancePage({ searchParams: searchParams() })).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledWith('/auth');
  expect(getAttendanceRecords).not.toHaveBeenCalled();
});

it('loads records for the search filters and offers active members to add', async () => {
  render(
    await AttendancePage({
      searchParams: searchParams({ q: 'ada', from: '2026-11-01', status: ['excused', 'manual'] }),
    }),
  );

  expect(getAttendanceRecords).toHaveBeenCalledWith({
    q: 'ada',
    from: '2026-11-01',
    to: undefined,
    status: undefined,
  });
  expect(screen.getByRole('heading', { name: 'Attendance' })).toBeInTheDocument();
  expect(screen.getByText('2.25')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Add record' }));
  const memberOptions = Array.from(document.querySelectorAll('#record-member option')).map(
    (option) => option.textContent,
  );
  expect(memberOptions).toEqual(['Select a member', 'Ada Lovelace', 'Grace Hopper']);
});

it('tells members without mentor access where their own hours are', async () => {
  (getAttendanceRecords as jest.Mock).mockResolvedValue('forbidden');

  render(await AttendancePage({ searchParams: searchParams() }));

  expect(screen.getByText('Attendance management is for mentors')).toBeInTheDocument();
  expect(getRosterView).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Add record' })).not.toBeInTheDocument();
});

it('disables adding records when the roster cannot be loaded', async () => {
  (getRosterView as jest.Mock).mockResolvedValue(null);
  (getEvents as jest.Mock).mockResolvedValue(null);

  render(await AttendancePage({ searchParams: searchParams() }));

  expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add record' })).toBeDisabled();
});

it('explains when attendance could not be loaded', async () => {
  (getAttendanceRecords as jest.Mock).mockResolvedValue(null);

  render(await AttendancePage({ searchParams: searchParams() }));

  expect(screen.getByText('Attendance could not be loaded')).toBeInTheDocument();
  expect(screen.getByText('Reload the page to try again.')).toBeInTheDocument();
});
