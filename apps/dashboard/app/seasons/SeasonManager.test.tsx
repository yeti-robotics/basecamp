import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SeasonManager } from './SeasonManager';

const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockRefresh }) }));

const suggestedDates = { startsOn: '2027-05-15', endsOn: '2028-05-14' };

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as jest.Mock;
});

it('shows current, upcoming, and past seasons with their date ranges', () => {
  render(
    <SeasonManager
      seasons={[
        { id: 1, name: '2025–26', startsOn: '2025-05-15', endsOn: '2026-05-14', period: 'past' },
        { id: 2, name: '2026–27', startsOn: '2026-05-15', endsOn: '2027-05-14', period: 'current' },
        {
          id: 3,
          name: '2027–28',
          startsOn: '2027-05-15',
          endsOn: '2028-05-14',
          period: 'upcoming',
        },
      ]}
      currentSeasonId={2}
      canManage={false}
      canBootstrap={false}
      suggestedDates={suggestedDates}
    />,
  );

  expect(screen.getByRole('heading', { name: 'Seasons' })).toBeInTheDocument();
  expect(screen.getByText('Current season')).toBeInTheDocument();
  expect(screen.getByText('Past season')).toBeInTheDocument();
  expect(screen.getByText('Upcoming season')).toBeInTheDocument();
  expect(screen.getByText('2025–26')).toBeInTheDocument();
  expect(screen.getByText(/May 15, 2027/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Create season' })).not.toBeInTheDocument();
});

it('shows the no-current-season state and suggests default dates for the first admin', () => {
  render(
    <SeasonManager
      seasons={[]}
      currentSeasonId={null}
      canManage={false}
      canBootstrap
      suggestedDates={suggestedDates}
    />,
  );

  expect(screen.getByText('No season is active today.')).toBeInTheDocument();
  expect(screen.getByLabelText('Season name')).toBeInTheDocument();
  expect(screen.getByLabelText('Start date')).toHaveValue('2027-05-15');
  expect(screen.getByLabelText('End date')).toHaveValue('2028-05-14');
});

it('creates a season through the same-origin API and refreshes the page', async () => {
  const refresh = jest.fn();
  render(
    <SeasonManager
      seasons={[]}
      currentSeasonId={null}
      canManage
      canBootstrap={false}
      suggestedDates={suggestedDates}
      refresh={refresh}
    />,
  );

  fireEvent.change(screen.getByLabelText('Season name'), { target: { value: '2027–28' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create season' }));

  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/seasons',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '2027–28', ...suggestedDates }),
      }),
    ),
  );
  expect(refresh).toHaveBeenCalled();
});
