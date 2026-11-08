import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { EventsList } from '../app/EventsList';
import type { TeamEvent } from '../lib/events';
import type { Season } from '../lib/seasons';

const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockRefresh }) }));

const now = '2026-11-07T17:00:00.000Z';
const seasons: Season[] = [
  { id: 1, name: '2025–26', startsOn: '2025-05-15', endsOn: '2026-05-14', period: 'past' },
  { id: 2, name: '2026–27', startsOn: '2026-05-15', endsOn: '2027-05-14', period: 'current' },
];

function teamEvent(overrides: Partial<TeamEvent>): TeamEvent {
  return {
    id: 1,
    seasonId: 2,
    seasonName: '2026–27',
    name: 'Weekly build meeting',
    description: null,
    location: 'Robotics lab',
    startsAt: '2026-11-10T21:30:00.000Z',
    endsAt: '2026-11-11T00:00:00.000Z',
    eventType: 'meeting',
    hourCategory: 'meeting',
    status: 'scheduled',
    ...overrides,
  };
}

const upcoming = teamEvent({
  id: 1,
  name: 'STEM night',
  description: 'Robot demo for kids.',
  location: 'Main Street Library',
  eventType: 'outreach',
  hourCategory: 'outreach',
});
const past = teamEvent({
  id: 2,
  name: 'Kickoff meeting',
  startsAt: '2026-11-03T21:30:00.000Z',
  endsAt: '2026-11-04T00:00:00.000Z',
});
const cancelled = teamEvent({
  id: 3,
  name: 'Parent info night',
  eventType: 'other',
  hourCategory: 'none',
  status: 'cancelled',
});

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function card(name: string) {
  const title = screen.getByText(name);
  const element = title.closest('[data-slot="card"]');
  if (!(element instanceof HTMLElement)) throw new Error(`No card for ${name}`);
  return within(element);
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue(jsonResponse({})) as jest.Mock;
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('shows members upcoming events separately from past and cancelled ones, without controls', () => {
  render(
    <EventsList
      events={[past, cancelled, upcoming]}
      canManage={false}
      seasons={seasons}
      now={now}
    />,
  );

  const upcomingSection = within(screen.getByRole('region', { name: 'Upcoming events' }));
  const previousSection = within(screen.getByRole('region', { name: 'Past and cancelled events' }));
  expect(upcomingSection.getByText('STEM night')).toBeInTheDocument();
  expect(upcomingSection.getByText('Outreach')).toBeInTheDocument();
  expect(upcomingSection.getByText('Outreach hours')).toBeInTheDocument();
  expect(upcomingSection.getByText('Robot demo for kids.')).toBeInTheDocument();
  expect(upcomingSection.getByText(/Tue, Nov 10, 2026 · 4:30 PM/)).toBeInTheDocument();
  expect(previousSection.getByText('Kickoff meeting')).toBeInTheDocument();
  expect(previousSection.getByText('Parent info night')).toBeInTheDocument();
  expect(previousSection.getByText('Cancelled')).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('shows the empty state when there are no events', () => {
  render(<EventsList events={[]} canManage={false} seasons={seasons} now={now} />);

  expect(screen.getByText('No events scheduled')).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Upcoming events' })).not.toBeInTheDocument();
});

it('only offers to cancel scheduled events that have not started', () => {
  render(<EventsList events={[upcoming, past, cancelled]} canManage seasons={seasons} now={now} />);

  expect(card('STEM night').getByRole('button', { name: 'Cancel event' })).toBeInTheDocument();
  expect(card('Kickoff meeting').queryByRole('button', { name: 'Cancel event' })).toBeNull();
  expect(card('Parent info night').queryByRole('button', { name: 'Cancel event' })).toBeNull();
  expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(3);
});

it('asks admins to create a season before scheduling events', () => {
  render(<EventsList events={[]} canManage seasons={[]} now={now} />);

  expect(screen.getByText('Create a season before scheduling an event.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add event' })).toBeDisabled();
});

it('creates an event in the current season through the same-origin API and refreshes', async () => {
  render(<EventsList events={[]} canManage seasons={seasons} now={now} />);

  fireEvent.click(screen.getByRole('button', { name: 'Add event' }));
  expect(screen.getByLabelText('Season')).toHaveValue('2');
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Saturday build' } });
  fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'extra_meeting' } });
  fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Robotics lab' } });
  fireEvent.change(screen.getByLabelText('Start time'), {
    target: { value: '2026-11-21T09:00' },
  });
  fireEvent.change(screen.getByLabelText('End time'), { target: { value: '2026-11-21T13:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create event' }));

  await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/events',
    expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  const [, request] = (global.fetch as jest.Mock).mock.calls[0];
  expect(JSON.parse(request.body)).toEqual({
    seasonId: 2,
    name: 'Saturday build',
    description: null,
    location: 'Robotics lab',
    startsAt: new Date('2026-11-21T09:00').toISOString(),
    endsAt: new Date('2026-11-21T13:00').toISOString(),
    eventType: 'extra_meeting',
    hourCategory: 'meeting',
  });
  expect(screen.queryByRole('button', { name: 'Create event' })).not.toBeInTheDocument();
});

it('prefills the edit form and saves changes with PATCH', async () => {
  render(<EventsList events={[upcoming]} canManage seasons={seasons} now={now} />);

  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  expect(screen.getByText('Edit event')).toBeInTheDocument();
  expect(screen.getByLabelText('Name')).toHaveValue('STEM night');
  expect(screen.getByLabelText('Hour contribution')).toHaveValue('outreach');
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'STEM family night' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save event' }));

  await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  const [url, request] = (global.fetch as jest.Mock).mock.calls[0];
  expect(url).toBe('/api/events/1');
  expect(request.method).toBe('PATCH');
  expect(JSON.parse(request.body)).toMatchObject({
    name: 'STEM family night',
    description: 'Robot demo for kids.',
    startsAt: upcoming.startsAt,
    endsAt: upcoming.endsAt,
  });
});

it('keeps the form open and shows the API message when saving fails', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue(jsonResponse({ message: 'End time must be after start time' }, 400));
  render(<EventsList events={[upcoming]} canManage seasons={seasons} now={now} />);

  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save event' }));

  expect(await screen.findByText('End time must be after start time')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save event' })).toBeEnabled();
  expect(mockRefresh).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByText('Edit event')).not.toBeInTheDocument();
});

it('shows a connection error when the save request fails', async () => {
  global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed'));
  render(<EventsList events={[upcoming]} canManage seasons={seasons} now={now} />);

  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save event' }));

  expect(
    await screen.findByText('The event could not be saved. Check your connection and try again.'),
  ).toBeInTheDocument();
});

it('cancels an event after confirmation and refreshes', async () => {
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  render(<EventsList events={[upcoming]} canManage seasons={seasons} now={now} />);

  fireEvent.click(screen.getByRole('button', { name: 'Cancel event' }));

  await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  expect(window.confirm).toHaveBeenCalledWith(
    'Cancel “STEM night”? It will remain visible as cancelled.',
  );
  expect(global.fetch).toHaveBeenCalledWith('/api/events/1/cancel', { method: 'POST' });
});

it('does nothing when the admin backs out of cancelling', () => {
  jest.spyOn(window, 'confirm').mockReturnValue(false);
  render(<EventsList events={[upcoming]} canManage seasons={seasons} now={now} />);

  fireEvent.click(screen.getByRole('button', { name: 'Cancel event' }));

  expect(global.fetch).not.toHaveBeenCalled();
});

it('shows why an event could not be cancelled', async () => {
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  global.fetch = jest.fn().mockResolvedValue(jsonResponse({}, 500));
  render(<EventsList events={[upcoming]} canManage seasons={seasons} now={now} />);

  fireEvent.click(screen.getByRole('button', { name: 'Cancel event' }));

  expect(await screen.findByText('The event could not be cancelled.')).toBeInTheDocument();
  expect(mockRefresh).not.toHaveBeenCalled();
});
