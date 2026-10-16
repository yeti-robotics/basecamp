import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import DashboardError from '../app/error';
import DashboardLoading from '../app/loading';
import { ErrorToast } from '../components/ErrorToast';

jest.mock('sonner', () => ({ toast: { error: jest.fn(), dismiss: jest.fn() } }));
beforeEach(() => jest.clearAllMocks());

it('announces loading without presenting placeholder hours or interactive controls', () => {
  render(<DashboardLoading />);
  expect(screen.getByRole('status', { name: 'Loading dashboard' })).toHaveAttribute(
    'aria-busy',
    'true',
  );
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(screen.queryByText('0.0')).not.toBeInTheDocument();
});

it('offers boundary recovery without exposing the raw server error', () => {
  const reset = jest.fn();
  render(<DashboardError error={new Error('private server details')} reset={reset} />);
  expect(screen.queryByText('private server details')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(reset).toHaveBeenCalledTimes(1);
  expect(toast.error).toHaveBeenCalledWith(
    'Dashboard could not be loaded',
    expect.objectContaining({ id: 'dashboard-error' }),
  );
});

it('uses a stable toast id and dismisses the failure when its state is removed', () => {
  const { rerender, unmount } = render(<ErrorToast id="test-failure" message="Could not load" />);
  rerender(<ErrorToast id="test-failure" message="Could not load" />);
  expect(toast.error).toHaveBeenCalledTimes(1);
  unmount();
  expect(toast.dismiss).toHaveBeenCalledWith('test-failure');
});
