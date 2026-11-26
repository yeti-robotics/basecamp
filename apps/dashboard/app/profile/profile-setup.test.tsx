import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProfileSetup } from './profile-setup';

const replace = jest.fn();
const refresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ name: 'Alex Member', preferredName: 'Sam Rivers' }),
  }) as jest.Mock;
});

it('saves a new preferred name and returns to the dashboard', async () => {
  render(<ProfileSetup initialName="" />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Preferred name' }), {
    target: { value: 'Sam Rivers' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));

  await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  expect(global.fetch).toHaveBeenCalledWith('/api/roster/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preferredName: 'Sam Rivers' }),
  });
  expect(refresh).toHaveBeenCalled();
});

it('lets members edit their name and reports save errors', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ message: 'Enter a name between 1 and 80 characters' }),
  }) as jest.Mock;
  render(<ProfileSetup initialName="Sam Rivers" />);

  expect(screen.getByRole('textbox', { name: 'Preferred name' })).toHaveValue('Sam Rivers');
  expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute('href', '/');
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Enter a name between 1 and 80 characters',
  );
  expect(replace).not.toHaveBeenCalled();
});

it('explains a profile response that does not confirm the saved name', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => null,
  }) as jest.Mock;
  render(<ProfileSetup initialName="" />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Preferred name' }), {
    target: { value: 'Sam Rivers' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save your name.');
  expect(replace).not.toHaveBeenCalled();
});

it('explains when the profile API cannot be reached', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as jest.Mock;
  render(<ProfileSetup initialName="" />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Preferred name' }), {
    target: { value: 'Sam Rivers' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not save your name. Check your connection and try again.',
  );
  expect(replace).not.toHaveBeenCalled();
});
