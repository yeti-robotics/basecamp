import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { redirect } from 'next/navigation';
import { getSession } from '../../lib/auth';
import { getEvents } from '../../lib/events';
import { getMemberProfile } from '../../lib/roster';
import { getSeasons } from '../../lib/seasons';
import EventsPage from './page';

// Mock backend requests so tests do not require a real API or database.
jest.mock('../../lib/auth', () => ({ getSession: jest.fn() }));
jest.mock('../../lib/events', () => ({ getEvents: jest.fn() }));
jest.mock('../../lib/roster', () => ({ getMemberProfile: jest.fn() }));
jest.mock('../../lib/seasons', () => ({ getSeasons: jest.fn() }));

jest.mock('next/navigation', () => ({
  redirect: jest.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
  useRouter: () => ({ refresh: jest.fn() }),
}));

const session = {
  user: { id: 'user-1', name: 'Ada', email: 'ada@example.com' },
  session: { id: 'session-1', expiresAt: '2026-12-01T00:00:00.000Z' },
};

const event = {
  id: 7,
  seasonId: 2,
  seasonName: '2026–27',
  name: 'Weekly build meeting',
  description: null,
  location: 'Robotics lab',
  startsAt: '2099-11-10T21:30:00.000Z',
  endsAt: '2099-11-11T00:00:00.000Z',
  eventType: 'meeting',
  hourCategory: 'meeting',
  status: 'scheduled',
};

const seasonView = {
  seasons: [
    {
      id: 2,
      name: '2026–27',
      startsOn: '2026-05-15',
      endsOn: '2027-05-14',
      period: 'current',
    },
  ],
  currentSeasonId: 2,
  canManage: true,
  canBootstrap: false,
  canView: true,
  suggestedDates: {
    startsOn: '2027-05-15',
    endsOn: '2028-05-14',
  },
};

// Reset mock data before each test to keep tests independent.
beforeEach(() => {
  jest.clearAllMocks();

  (getSession as jest.Mock).mockResolvedValue(session);

  (getMemberProfile as jest.Mock).mockResolvedValue({
    name: 'Ada',
    preferredName: 'Ada',
  });

  (getEvents as jest.Mock).mockResolvedValue([event]);
  (getSeasons as jest.Mock).mockResolvedValue(seasonView);
});

it('redirects to sign-in without a session', async () => {
  (getSession as jest.Mock).mockResolvedValue(null);

  await expect(EventsPage()).rejects.toThrow('NEXT_REDIRECT');

  expect(redirect).toHaveBeenCalledWith('/auth');
  expect(getMemberProfile).not.toHaveBeenCalled();
  expect(getEvents).not.toHaveBeenCalled();
});

it('sends members without a preferred name to onboarding', async () => {
  (getMemberProfile as jest.Mock).mockResolvedValue(null);

  await expect(EventsPage()).rejects.toThrow('NEXT_REDIRECT');

  expect(redirect).toHaveBeenCalledWith('/profile');
  expect(getEvents).not.toHaveBeenCalled();
});

// The calendar should be the first view members see.
it('displays the calendar by default', async () => {
  render(await EventsPage());

  expect(screen.getByRole('heading', { name: 'Events' })).toBeInTheDocument();

  expect(screen.getByRole('region', { name: 'Team calendar' })).toBeVisible();

  expect(screen.getByRole('button', { name: 'Calendar' })).toHaveAttribute('aria-pressed', 'true');

  expect(screen.getByRole('button', { name: 'Event list' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

// Users should be able to switch between both event views.
it('switches between calendar and event list views', async () => {
  render(await EventsPage());

  fireEvent.click(screen.getByRole('button', { name: 'Event list' }));

  expect(screen.getByRole('button', { name: 'Event list' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  expect(screen.getByText('Weekly build meeting')).toBeVisible();

  expect(screen.queryByRole('region', { name: 'Team calendar' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Calendar' }));

  expect(screen.getByRole('region', { name: 'Team calendar' })).toBeVisible();

  expect(screen.getByRole('button', { name: 'Calendar' })).toHaveAttribute('aria-pressed', 'true');
});

// Admin management controls are available inside the event list.
it('shows the events with management controls for Team Admins', async () => {
  render(await EventsPage());

  fireEvent.click(screen.getByRole('button', { name: 'Event list' }));

  expect(screen.getByText('Weekly build meeting')).toBeVisible();

  expect(screen.getByRole('button', { name: 'Add event' })).toBeVisible();
});

// Members without management permissions cannot create events.
it('hides management controls for non-admin members', async () => {
  (getSeasons as jest.Mock).mockResolvedValue({
    ...seasonView,
    canManage: false,
  });

  render(await EventsPage());

  fireEvent.click(screen.getByRole('button', { name: 'Event list' }));

  expect(screen.getByText('Weekly build meeting')).toBeVisible();

  expect(screen.queryByRole('button', { name: 'Add event' })).not.toBeInTheDocument();

  expect(screen.queryByRole('button', { name: 'Edit', exact: true })).not.toBeInTheDocument();

  expect(screen.queryByRole('button', { name: 'Cancel event' })).not.toBeInTheDocument();
});

// Missing season information should never grant management permissions.
it('hides management controls when the season view is unavailable', async () => {
  (getSeasons as jest.Mock).mockResolvedValue(null);

  render(await EventsPage());

  fireEvent.click(screen.getByRole('button', { name: 'Event list' }));

  expect(screen.getByText('Weekly build meeting')).toBeVisible();

  expect(screen.queryByRole('button', { name: 'Add event' })).not.toBeInTheDocument();
});

// Display a recoverable error if the events API fails.
it('explains when events could not be loaded', async () => {
  (getEvents as jest.Mock).mockResolvedValue(null);

  render(await EventsPage());

  expect(screen.getByText('Events could not be loaded')).toBeInTheDocument();

  expect(screen.getByText('Reload the page to try again.')).toBeInTheDocument();
});
