import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { getSession } from '../../lib/auth';
import { getEvents } from '../../lib/events';
import { getSeasons } from '../../lib/seasons';
import EventsPage from './page';

jest.mock('../../lib/auth', () => ({ getSession: jest.fn() }));
jest.mock('../../lib/events', () => ({ getEvents: jest.fn() }));
jest.mock('../../lib/seasons', () => ({ getSeasons: jest.fn() }));
jest.mock('next/navigation', () => ({
  redirect: jest.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
  useRouter: () => ({ refresh: jest.fn() }),
}));

import { redirect } from 'next/navigation';

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
    { id: 2, name: '2026–27', startsOn: '2026-05-15', endsOn: '2027-05-14', period: 'current' },
  ],
  currentSeasonId: 2,
  canManage: true,
  canBootstrap: false,
  canView: true,
  suggestedDates: { startsOn: '2027-05-15', endsOn: '2028-05-14' },
};

beforeEach(() => {
  jest.clearAllMocks();
  (getSession as jest.Mock).mockResolvedValue(session);
  (getEvents as jest.Mock).mockResolvedValue([event]);
  (getSeasons as jest.Mock).mockResolvedValue(seasonView);
});

it('redirects to sign-in without a session', async () => {
  (getSession as jest.Mock).mockResolvedValue(null);

  await expect(EventsPage()).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledWith('/auth');
  expect(getEvents).not.toHaveBeenCalled();
});

it('shows the events with management controls for Team Admins', async () => {
  render(await EventsPage());

  expect(screen.getByRole('heading', { name: 'Events' })).toBeInTheDocument();
  expect(screen.getByText('Weekly build meeting')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add event' })).toBeInTheDocument();
});

it('hides management controls when the season view is unavailable', async () => {
  (getSeasons as jest.Mock).mockResolvedValue(null);

  render(await EventsPage());

  expect(screen.getByText('Weekly build meeting')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add event' })).not.toBeInTheDocument();
});

it('explains when events could not be loaded', async () => {
  (getEvents as jest.Mock).mockResolvedValue(null);

  render(await EventsPage());

  expect(screen.getByText('Events could not be loaded')).toBeInTheDocument();
  expect(screen.getByText('Reload the page to try again.')).toBeInTheDocument();
});
