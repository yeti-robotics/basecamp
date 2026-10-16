import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { DashboardOverview } from '../app/DashboardOverview';
import type { AttendanceOverview } from '../lib/attendance';

jest.mock('../app/SignOutButton', () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));
const user = { id: 'member-a', name: 'Alex Member', email: 'alex@example.com' };
const attendance: AttendanceOverview = {
  season: { id: 1, name: '2026–27' },
  hours: { meeting: 12.5, outreach: 4, total: 16.5 },
  requirements: { meeting: 10, outreach: null },
  recentActivity: [
    {
      id: 1,
      category: 'meeting',
      name: 'Robot build',
      checkedInAt: '2026-10-12T17:00:00Z',
      checkedOutAt: null,
      hours: 0,
    },
  ],
};

it('renders fetched hours, caps progress, and identifies open attendance', () => {
  render(<DashboardOverview user={user} attendance={attendance} />);
  expect(screen.getByText('16.5')).toBeInTheDocument();
  expect(screen.getByText('Robot build')).toBeInTheDocument();
  expect(screen.getByText('In progress')).toBeInTheDocument();
  expect(screen.getByRole('progressbar', { name: 'Meeting attendance progress' })).toHaveAttribute(
    'aria-valuenow',
    '100',
  );
  expect(
    screen.queryByRole('progressbar', { name: 'Outreach participation progress' }),
  ).not.toBeInTheDocument();
});

it('distinguishes API failure from empty history', () => {
  render(<DashboardOverview user={user} attendance={null} />);
  expect(screen.getByRole('status')).toHaveTextContent('Attendance could not be loaded');
  expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/');
  expect(screen.queryByText('No attendance recorded this season')).not.toBeInTheDocument();
  expect(screen.queryByText('0.0')).not.toBeInTheDocument();
});

it('shows the empty state only after successfully fetching no records', () => {
  render(
    <DashboardOverview
      user={user}
      attendance={{
        ...attendance,
        hours: { meeting: 0, outreach: 0, total: 0 },
        recentActivity: [],
      }}
    />,
  );
  expect(screen.getByText('No attendance recorded this season')).toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('keeps progress within the accessible range for negative hours', () => {
  render(
    <DashboardOverview
      user={user}
      attendance={{ ...attendance, hours: { ...attendance.hours, meeting: -1 } }}
    />,
  );
  expect(screen.getByRole('progressbar', { name: 'Meeting attendance progress' })).toHaveAttribute(
    'aria-valuenow',
    '0',
  );
});

it('handles zero requirements without rendering an invalid progress bar', () => {
  render(
    <DashboardOverview
      user={user}
      attendance={{ ...attendance, requirements: { meeting: 0, outreach: 0 } }}
    />,
  );
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  expect(screen.getAllByText('No hours required')).toHaveLength(2);
});

it('shows completed attendance hours and a missing-season notice', () => {
  render(
    <DashboardOverview
      user={user}
      attendance={{
        ...attendance,
        season: null,
        recentActivity: [
          { ...attendance.recentActivity[0]!, checkedOutAt: '2026-10-12T19:00:00Z', hours: 2 },
        ],
      }}
    />,
  );
  expect(screen.getByText('No active season is configured yet.')).toBeInTheDocument();
  expect(screen.getByText('2.0 hrs')).toBeInTheDocument();
  expect(screen.queryByText('In progress')).not.toBeInTheDocument();
});
