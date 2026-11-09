import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AttendanceRecord } from '../../lib/attendance-records';
import type { TeamEvent } from '../../lib/events';
import { AttendanceManager } from './AttendanceManager';

const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockRefresh }) }));

const members = [
  { userId: 'student-1', name: 'Ada Lovelace' },
  { userId: 'student-2', name: 'Grace Hopper' },
];

const meeting: TeamEvent = {
  id: 3,
  seasonId: 2,
  seasonName: '2026–27',
  name: 'Saturday build session',
  description: null,
  location: 'Robotics lab',
  startsAt: '2026-11-07T14:00:00.000Z',
  endsAt: '2026-11-07T18:00:00.000Z',
  eventType: 'extra_meeting',
  hourCategory: 'meeting',
  status: 'scheduled',
};

function attendanceRecord(overrides: Partial<AttendanceRecord>): AttendanceRecord {
  return {
    id: 1,
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
    ...overrides,
  };
}

const signedIn = attendanceRecord({ id: 1 });
const forgotSignOut = attendanceRecord({
  id: 2,
  userId: 'student-2',
  memberName: 'Grace Hopper',
  checkedOutAt: null,
  hours: 0,
});
const excused = attendanceRecord({
  id: 3,
  status: 'excused',
  eventId: 3,
  eventName: 'Saturday build session',
  checkedInAt: meeting.startsAt,
  checkedOutAt: meeting.endsAt,
  hours: 4,
  edited: true,
});

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function renderManager(
  records: AttendanceRecord[] = [signedIn, forgotSignOut, excused],
  search = {},
) {
  return render(
    <AttendanceManager
      records={records}
      truncated={false}
      members={members}
      events={[meeting]}
      search={search}
    />,
  );
}

function row(memberName: string, index = 0) {
  const element = screen.getAllByText(memberName)[index]?.closest('tr');
  if (!element) throw new Error(`No row for ${memberName}`);
  return within(element);
}

function requestBody(call = 0) {
  const [, request] = (global.fetch as jest.Mock).mock.calls[call];
  return JSON.parse(request.body);
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue(jsonResponse({})) as jest.Mock;
});

it('lists records with their hours, status, and missing sign-outs', () => {
  renderManager();

  expect(screen.getByRole('heading', { name: 'Records' })).toBeInTheDocument();
  expect(row('Ada Lovelace').getByText('2.25')).toBeInTheDocument();
  expect(row('Ada Lovelace').getByText('Signed in')).toBeInTheDocument();
  expect(row('Grace Hopper').getByText('no sign-out')).toBeInTheDocument();
  expect(row('Ada Lovelace', 1).getByText('Excused')).toBeInTheDocument();
  expect(row('Ada Lovelace', 1).getByText('Edited')).toBeInTheDocument();
  expect(row('Ada Lovelace', 1).getByText(/Saturday build session/)).toBeInTheDocument();
});

it('keeps the current filters in the search form and offers to clear them', () => {
  renderManager([], { q: 'ada', from: '2026-11-01', status: 'excused' });

  const filters = within(screen.getByRole('form', { name: 'Filter attendance records' }));
  expect(filters.getByLabelText('Member')).toHaveValue('ada');
  expect(filters.getByLabelText('From')).toHaveValue('2026-11-01');
  expect(filters.getByLabelText('Status')).toHaveValue('excused');
  expect(screen.getByRole('link', { name: 'Clear' })).toHaveAttribute('href', '/attendance');
  expect(screen.getByText('No records match these filters.')).toBeInTheDocument();
});

it('explains the empty state before anyone has signed in', () => {
  renderManager([]);

  expect(screen.getByText('Records will appear here when members sign in.')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Clear' })).not.toBeInTheDocument();
});

it('warns when only the most recent matches are shown', () => {
  render(
    <AttendanceManager records={[signedIn]} truncated members={members} events={[]} search={{}} />,
  );

  expect(screen.getByText(/Showing the 200 most recent matches/)).toBeInTheDocument();
});

it('adds an excused record from an event with a reason and refreshes', async () => {
  renderManager();

  fireEvent.click(screen.getByRole('button', { name: 'Add record' }));
  fireEvent.change(screen.getByLabelText('Member', { selector: 'select' }), {
    target: { value: 'student-2' },
  });
  fireEvent.change(screen.getByLabelText('Event (optional)'), { target: { value: '3' } });
  expect(screen.getByLabelText('Status', { selector: '#record-status' })).toHaveValue('excused');
  fireEvent.change(screen.getByLabelText('Reason'), {
    target: { value: 'School band concert' },
  });
  const form = screen.getByLabelText('Reason').closest('form') as HTMLFormElement;
  fireEvent.click(within(form).getByRole('button', { name: 'Add record' }));

  await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/attendance/records',
    expect.objectContaining({ method: 'POST', headers: { 'Content-Type': 'application/json' } }),
  );
  expect(requestBody()).toEqual({
    userId: 'student-2',
    eventId: 3,
    checkedInAt: meeting.startsAt,
    checkedOutAt: meeting.endsAt,
    category: 'meeting',
    status: 'excused',
    reason: 'School band concert',
  });
  expect(screen.queryByLabelText('Reason')).not.toBeInTheDocument();
});

it('adds a missed sign-in with times entered by hand', async () => {
  renderManager();

  fireEvent.click(screen.getByRole('button', { name: 'Add record' }));
  fireEvent.change(screen.getByLabelText('Member', { selector: 'select' }), {
    target: { value: 'student-1' },
  });
  fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '2026-11-12T16:30' } });
  fireEvent.change(screen.getByLabelText('End time'), { target: { value: '2026-11-12T19:00' } });
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'outreach' } });
  fireEvent.change(screen.getByLabelText('Status', { selector: '#record-status' }), {
    target: { value: 'manual' },
  });
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Phone was dead' } });
  const form = screen.getByLabelText('Reason').closest('form') as HTMLFormElement;
  fireEvent.click(within(form).getByRole('button', { name: 'Add record' }));

  await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  expect(requestBody()).toEqual({
    userId: 'student-1',
    eventId: null,
    checkedInAt: new Date('2026-11-12T16:30').toISOString(),
    checkedOutAt: new Date('2026-11-12T19:00').toISOString(),
    category: 'outreach',
    status: 'manual',
    reason: 'Phone was dead',
  });
});

it('fills in a forgotten sign-out and sends only the changed fields', async () => {
  renderManager();

  fireEvent.click(row('Grace Hopper').getByRole('button', { name: /Edit/ }));
  expect(screen.getByText('Edit Grace Hopper')).toBeInTheDocument();
  expect(screen.getByLabelText('Status', { selector: '#record-status' })).toHaveValue('');
  fireEvent.change(screen.getByLabelText('End time'), { target: { value: '2026-11-05T19:30' } });
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Forgot to sign out' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

  await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  const [url, request] = (global.fetch as jest.Mock).mock.calls[0];
  expect(url).toBe('/api/attendance/records/2');
  expect(request.method).toBe('PATCH');
  expect(JSON.parse(request.body)).toEqual({
    checkedOutAt: new Date('2026-11-05T19:30').toISOString(),
    reason: 'Forgot to sign out',
  });
});

it('can excuse a signed-in record and change its event', async () => {
  renderManager();

  fireEvent.click(row('Ada Lovelace').getByRole('button', { name: /Edit/ }));
  fireEvent.change(screen.getByLabelText('Status', { selector: '#record-status' }), {
    target: { value: 'excused' },
  });
  fireEvent.change(screen.getByLabelText('Event (optional)'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Left for a game' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

  await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  expect(requestBody()).toEqual({ status: 'excused', eventId: 3, reason: 'Left for a game' });
});

it('does not send an edit with no changes', () => {
  renderManager();

  fireEvent.click(row('Ada Lovelace').getByRole('button', { name: /Edit/ }));
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Just checking' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

  expect(screen.getByText('Change at least one field before saving.')).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

it('keeps the form open and shows the API message when saving fails', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue(jsonResponse({ message: 'End time must be after start time' }, 400));
  renderManager();

  fireEvent.click(row('Grace Hopper').getByRole('button', { name: /Edit/ }));
  fireEvent.change(screen.getByLabelText('End time'), { target: { value: '2026-11-05T15:00' } });
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Typo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

  expect(await screen.findByText('End time must be after start time')).toBeInTheDocument();
  expect(mockRefresh).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByText('Edit Grace Hopper')).not.toBeInTheDocument();
});

it('shows a connection error when the save request fails', async () => {
  global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed'));
  renderManager();

  fireEvent.click(row('Grace Hopper').getByRole('button', { name: /Edit/ }));
  fireEvent.change(screen.getByLabelText('End time'), { target: { value: '2026-11-05T19:30' } });
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Forgot' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

  expect(
    await screen.findByText('The record could not be saved. Check your connection and try again.'),
  ).toBeInTheDocument();
});

it('shows who changed a record, why, and what changed', async () => {
  global.fetch = jest.fn().mockResolvedValue(
    jsonResponse([
      {
        id: 1,
        action: 'record_updated',
        actorName: 'Mia Mentor',
        before: {
          userId: 'student-1',
          checkedInAt: excused.checkedInAt,
          checkedOutAt: excused.checkedOutAt,
          category: 'meeting',
          eventId: null,
          status: 'normal',
        },
        after: {
          userId: 'student-1',
          checkedInAt: excused.checkedInAt,
          checkedOutAt: excused.checkedOutAt,
          category: 'meeting',
          eventId: 3,
          status: 'excused',
        },
        reason: 'Away at a competition',
        createdAt: '2026-11-08T15:00:00.000Z',
      },
    ]),
  );
  renderManager();

  const historyButton = row('Ada Lovelace', 1).getByRole('button', { name: /History/ });
  fireEvent.click(historyButton);

  expect(await screen.findByText('Reason: Away at a competition')).toBeInTheDocument();
  expect(historyButton).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText(/by Mia Mentor/)).toBeInTheDocument();
  expect(screen.getByText('Status: Signed in → Excused')).toBeInTheDocument();
  expect(screen.getByText('Event: — → Saturday build session')).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith('/api/attendance/records/3/history');

  fireEvent.click(historyButton);
  expect(screen.queryByText('Reason: Away at a competition')).not.toBeInTheDocument();
});

it('shows the creation entry for a record a mentor added', async () => {
  global.fetch = jest.fn().mockResolvedValue(
    jsonResponse([
      {
        id: 2,
        action: 'record_created',
        actorName: null,
        before: null,
        after: null,
        reason: 'Missed sign-in',
        createdAt: '2026-11-08T15:00:00.000Z',
      },
    ]),
  );
  renderManager();

  fireEvent.click(row('Ada Lovelace').getByRole('button', { name: /History/ }));

  expect(await screen.findByText('Reason: Missed sign-in')).toBeInTheDocument();
  expect(screen.getByText('Added', { selector: 'span' })).toBeInTheDocument();
  expect(screen.getByText(/by an unknown user/)).toBeInTheDocument();
});

it('explains when a record has no history or the history cannot load', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce(jsonResponse([]))
    .mockResolvedValueOnce(jsonResponse({ message: 'Attendance record not found' }, 404));
  renderManager();

  fireEvent.click(row('Ada Lovelace').getByRole('button', { name: /History/ }));
  expect(await screen.findByText('No changes have been made to this record.')).toBeInTheDocument();

  fireEvent.click(row('Grace Hopper').getByRole('button', { name: /History/ }));
  expect(await screen.findByText('Attendance record not found')).toBeInTheDocument();
});
