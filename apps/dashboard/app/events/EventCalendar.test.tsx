import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { TeamEvent } from '@/lib/events';
import { EventCalendar } from './EventCalendar';

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

const outreach: TeamEvent = {
  ...meeting,
  id: 2,
  name: 'Community outreach',
  eventType: 'outreach',
  hourCategory: 'outreach',
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

  it('filters events by type', () => {
    render(<EventCalendar events={[meeting, outreach]} now={now} />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter event type' }), {
      target: { value: 'outreach' },
    });

    expect(screen.getByText('Community outreach')).toBeInTheDocument();

    expect(screen.queryByText('Build meeting')).not.toBeInTheDocument();
  });

  it('shows cancelled events without attendance contribution', () => {
    const cancelledEvent: TeamEvent = {
      ...meeting,
      status: 'cancelled',
    };

    render(<EventCalendar events={[cancelledEvent]} now={now} />);

    fireEvent.click(screen.getByRole('button', { name: 'December 2026 day 5' }));

    expect(within(screen.getByRole('article')).getByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByText(/No attendance hours/)).toBeInTheDocument();
  });
});
