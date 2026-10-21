import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BotSettings, type BotStatus } from './BotSettings';

const status: BotStatus = {
  desiredEnabled: false,
  tokenConfigured: false,
  connection: 'off',
  statusMessage: 'YETI ARE YOU READY?',
};

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => status }) as jest.Mock;
});

it('shows whether the token is configured and the observed connection state', () => {
  render(
    <BotSettings initialStatus={{ ...status, tokenConfigured: true, connection: 'connected' }} />,
  );
  expect(screen.getByText('Token saved')).toBeInTheDocument();
  expect(screen.getByText('Connected')).toBeInTheDocument();
  expect(screen.getByRole('switch', { name: 'Enable Discord bot' })).not.toBeChecked();
});

it('saves a write-only token without enabling the bot and clears the input', async () => {
  const savedStatus = { ...status, tokenConfigured: true };
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => savedStatus }) as jest.Mock;
  render(<BotSettings initialStatus={status} />);
  fireEvent.change(screen.getByLabelText('Discord bot token'), {
    target: { value: 'plain-secret-token' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save token' }));

  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/settings/bot/token',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ token: 'plain-secret-token' }),
      }),
    ),
  );
  await waitFor(() => expect(screen.getByLabelText('Discord bot token')).toHaveValue(''));
  expect(screen.getByText('Token saved')).toBeInTheDocument();
  expect(screen.getByRole('switch', { name: 'Enable Discord bot' })).not.toBeChecked();
  expect(document.body).not.toHaveTextContent('plain-secret-token');
});

it('enables after token setup, displays connection states, and disables cleanly', async () => {
  const connecting = {
    ...status,
    tokenConfigured: true,
    desiredEnabled: true,
    connection: 'connecting' as const,
  };
  const connected = { ...connecting, connection: 'connected' as const };
  const off = { ...connected, desiredEnabled: false, connection: 'off' as const };
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({ ok: true, json: async () => connecting })
    .mockResolvedValueOnce({ ok: true, json: async () => connected })
    .mockResolvedValueOnce({ ok: true, json: async () => off });
  render(<BotSettings initialStatus={{ ...status, tokenConfigured: true }} />);

  fireEvent.click(screen.getByRole('switch', { name: 'Enable Discord bot' }));
  await waitFor(() => expect(screen.getByText('Connecting')).toBeInTheDocument());
  await waitFor(() => expect(screen.getByText('Connected')).toBeInTheDocument());
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/settings/bot/enabled',
    expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ enabled: true }),
    }),
  );

  fireEvent.click(screen.getByRole('switch', { name: 'Enable Discord bot' }));
  await waitFor(() => expect(screen.getByText('Off')).toBeInTheDocument());
});

it('allows disabling while an enable request is still pending', async () => {
  const pending: Array<(value: { ok: boolean; json: () => Promise<BotStatus> }) => void> = [];
  global.fetch = jest.fn((url: string) => {
    if (url === '/api/settings/bot/enabled') {
      return new Promise((resolve) => pending.push(resolve));
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({
        ...status,
        tokenConfigured: true,
        desiredEnabled: true,
        connection: 'connecting',
      }),
    });
  }) as jest.Mock;
  render(<BotSettings initialStatus={{ ...status, tokenConfigured: true }} />);
  const toggle = screen.getByRole('switch', { name: 'Enable Discord bot' });
  fireEvent.click(toggle);
  fireEvent.click(toggle);
  const writes = (global.fetch as jest.Mock).mock.calls.filter(
    ([url]) => url === '/api/settings/bot/enabled',
  );
  expect(writes).toHaveLength(2);
  expect(JSON.parse(writes[0][1].body)).toEqual({ enabled: true });
  expect(JSON.parse(writes[1][1].body)).toEqual({ enabled: false });
  const resolveEnable = pending[0];
  const resolveDisable = pending[1];
  if (!resolveEnable || !resolveDisable) throw new Error('Expected enable and disable requests');
  resolveEnable({
    ok: true,
    json: async () => ({
      ...status,
      tokenConfigured: true,
      desiredEnabled: true,
      connection: 'connected',
    }),
  });
  resolveDisable({ ok: true, json: async () => ({ ...status, tokenConfigured: true }) });
  await waitFor(() => expect(screen.getByText('Off')).toBeInTheDocument());
});

it('shows a safe failure state and retries with the saved setting', async () => {
  const connected = {
    desiredEnabled: true,
    tokenConfigured: true,
    connection: 'connected' as const,
    statusMessage: 'YETI ARE YOU READY?',
  };
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        desiredEnabled: true,
        tokenConfigured: true,
        connection: 'failed',
        statusMessage: 'YETI ARE YOU READY?',
      }),
    })
    .mockResolvedValue({ ok: true, json: async () => connected }) as jest.Mock;
  render(
    <BotSettings
      initialStatus={{
        desiredEnabled: true,
        tokenConfigured: true,
        connection: 'failed',
        statusMessage: 'YETI ARE YOU READY?',
      }}
    />,
  );
  expect(screen.getByText('Discord could not connect')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry connection' }));
  await waitFor(() => expect(screen.getByText('Connected')).toBeInTheDocument());
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/settings/bot/enabled',
    expect.objectContaining({ body: JSON.stringify({ enabled: true }) }),
  );
});

it('saves a custom Discord status message', async () => {
  const saved = { ...status, statusMessage: 'Scrimmage tonight' };
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => saved }) as jest.Mock;
  render(<BotSettings initialStatus={{ ...status, statusMessage: 'YETI ARE YOU READY?' }} />);

  const input = screen.getByLabelText('Status message');
  expect(input).toHaveValue('YETI ARE YOU READY?');
  fireEvent.change(input, { target: { value: '   ' } });
  expect(screen.getByRole('button', { name: 'Save status message' })).toBeDisabled();
  fireEvent.change(input, { target: { value: 'Scrimmage tonight' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save status message' }));

  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/settings/bot/status-message',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ statusMessage: 'Scrimmage tonight' }),
      }),
    ),
  );
  expect(input).toHaveValue('Scrimmage tonight');
});

it('supports keyboard use of the shadcn switch', () => {
  global.fetch = jest.fn(() => new Promise(() => undefined)) as jest.Mock;
  render(<BotSettings initialStatus={{ ...status, tokenConfigured: true }} />);
  const toggle = screen.getByRole('switch', { name: 'Enable Discord bot' });
  toggle.focus();
  expect(toggle).toHaveFocus();
  expect(toggle).toBeEnabled();
  expect(toggle).toHaveAttribute('type', 'button');
});
