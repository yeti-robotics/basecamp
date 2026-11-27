import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { TeamEvent } from '@/lib/events';
import { EventCalendar } from './EventCalendar';

// Use a fixed timestamp so tests are consistent regardless of today's date.
const now = '2026-12-01T17:00:00.000Z';

// Sample events representing data returned by the API.
const meeting: TeamEvent = {
  id: 1,
  seasonId: 1,
  seasonName: '2026-27',
  name: 'Build meeting',
  description: 'Work on the robot',
  location: 'Robotics lab',
  startsAt: '2026-12-05T22:00:00.000Z',
  endsAt: '2026-12-06T01:00:00.000Z',
  eventType: 'meeting',
  hourCategory: 'meeting',
  status: 'scheduled',
};

// Reuse the meeting data while overriding outreach-specific properties.
const outreach: TeamEvent = {
  ...meeting,
  id: 2,
  name: 'Community outreach',
  eventType: 'outreach',
  hourCategory: 'outreach',
};

// An event associated with a different season for testing filters.
const olderEvent: TeamEvent = {
  ...meeting,
  id: 3,
  seasonId: 2,
  seasonName: '2025-26',
  name: 'Previous season meeting',
};

describe('EventCalendar', () => {
  it('renders the current month', () => {
    render(<EventCalendar events={[]} now={now} />);

    expect(screen.getByRole('heading', { name: 'December 2026' })).toBeInTheDocument();
  });

  it('navigates to the next month and year', () => {
    render(<EventCalendar events={[]} now={now} />);

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));

    expect(screen.getByRole('heading', { name: 'January 2027' })).toBeInTheDocument();
  });

  it('navigates to the previous month', () => {
    render(<EventCalendar events={[]} now={now} />);

    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));

    expect(screen.getByRole('heading', { name: 'November 2026' })).toBeInTheDocument();
  });

  it('returns to the current date', () => {
    render(<EventCalendar events={[]} now={now} />);

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));

    fireEvent.click(screen.getByRole('button', { name: 'Today' }));

    expect(screen.getByRole('heading', { name: 'December 2026' })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'December 2026 day 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows event details when selecting a date', () => {
    render(<EventCalendar events={[meeting]} now={now} />);

    fireEvent.click(screen.getByRole('button', { name: 'December 2026 day 5' }));

    expect(screen.getByText('Work on the robot')).toBeInTheDocument();

    expect(screen.getByText('Robotics lab')).toBeInTheDocument();

    const article = screen.getByRole('article');

    expect(within(article).getByText('Build meeting')).toBeInTheDocument();
  });

  it('shows an empty state when no events exist', () => {
    render(<EventCalendar events={[]} now={now} />);

    expect(screen.getByText('No events scheduled for this date.')).toBeInTheDocument();
  });

  // Verify that filtering by event type hides unrelated events.
  it('filters events by type', () => {
    render(<EventCalendar events={[meeting, outreach]} now={now} />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter event type' }), {
      target: { value: 'outreach' },
    });

    expect(screen.getByText('Community outreach')).toBeVisible();

    expect(screen.queryByText('Build meeting')).not.toBeInTheDocument();
  });

  // Verify that selecting a season only displays its associated events.
  it('filters events by season', () => {
    render(<EventCalendar events={[meeting, olderEvent]} now={now} />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter season' }), {
      target: { value: '2' },
    });

    expect(screen.getByText('Previous season meeting')).toBeVisible();

    expect(screen.queryByText('Build meeting')).not.toBeInTheDocument();
  });

  // Events must satisfy both filters at the same time.
  it('combines event type and season filters', () => {
    render(<EventCalendar events={[meeting, outreach, olderEvent]} now={now} />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter season' }), {
      target: { value: '1' },
    });

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter event type' }), {
      target: { value: 'meeting' },
    });

    expect(screen.getByText('Build meeting')).toBeVisible();

    expect(screen.queryByText('Community outreach')).not.toBeInTheDocument();

    expect(screen.queryByText('Previous season meeting')).not.toBeInTheDocument();
  });

  // Multiple events in one season should not duplicate dropdown options.
  it('does not duplicate season options', () => {
    render(<EventCalendar events={[meeting, outreach]} now={now} />);

    const seasonSelect = screen.getByRole('combobox', {
      name: 'Filter season',
    });

    expect(
      within(seasonSelect).getAllByRole('option', {
        name: '2026-27',
      }),
    ).toHaveLength(1);
  });

  // Selecting all seasons should restore previously filtered events.
  it('restores events when the season filter is cleared', () => {
    render(<EventCalendar events={[meeting, olderEvent]} now={now} />);

    const seasonSelect = screen.getByRole('combobox', {
      name: 'Filter season',
    });

    fireEvent.change(seasonSelect, {
      target: { value: '2' },
    });

    expect(screen.queryByText('Build meeting')).not.toBeInTheDocument();

    fireEvent.change(seasonSelect, {
      target: { value: 'all' },
    });

    expect(screen.getByText('Build meeting')).toBeVisible();

    expect(screen.getByText('Previous season meeting')).toBeVisible();
  });

  it('shows cancelled events without scheduled attendance contribution', () => {
    const cancelledEvent: TeamEvent = {
      ...meeting,
      status: 'cancelled',
    };

    render(<EventCalendar events={[cancelledEvent]} now={now} />);

    fireEvent.click(screen.getByRole('button', { name: 'December 2026 day 5' }));

    const article = screen.getByRole('article');

    expect(within(article).getByText('Cancelled')).toBeInTheDocument();

    expect(within(article).getByText(/No attendance hours/)).toBeInTheDocument();
  });

  // An overnight event should appear on both occupied calendar dates.
  it('displays overnight events across multiple days', () => {
    const overnightEvent: TeamEvent = {
      ...meeting,
      name: 'Overnight build session',
      endsAt: '2026-12-06T07:00:00.000Z',
    };

    render(<EventCalendar events={[overnightEvent]} now={now} />);

    const firstDay = screen.getByRole('button', {
      name: 'December 2026 day 5',
    });

    const secondDay = screen.getByRole('button', {
      name: 'December 2026 day 6',
    });

    expect(within(firstDay).getByText('Overnight build session')).toBeVisible();

    expect(within(secondDay).getByText('Overnight build session')).toBeVisible();

    fireEvent.click(secondDay);

    const article = screen.getByRole('article');

    expect(within(article).getByText('Overnight build session')).toBeVisible();

    expect(within(article).getByText(/Dec 5, 2026/)).toBeInTheDocument();

    expect(within(article).getByText(/Dec 6, 2026/)).toBeInTheDocument();
  });

  // Calendar cells only preview two events, but details show all events.
  it('shows an overflow indicator when a date has more than two events', () => {
    render(<EventCalendar events={[meeting, outreach, olderEvent]} now={now} />);

    const day = screen.getByRole('button', {
      name: 'December 2026 day 5',
    });

    expect(within(day).getByText('+1 more')).toBeVisible();

    fireEvent.click(day);

    expect(screen.getAllByRole('article')).toHaveLength(3);
  });
});
