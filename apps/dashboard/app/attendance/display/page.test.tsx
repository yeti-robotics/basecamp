import { fireEvent, render, screen } from '@testing-library/react';
import DisplayPage from './page';

const seed = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('facility display page', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('unlocks with the mentor password, shows the code, and clears it on logout', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(270_000);
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: true, status: 204 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ secret: seed, expiresAt: 43_470_000 }),
      })
      .mockResolvedValueOnce({ ok: true, status: 204 });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<DisplayPage />);
    const input = await screen.findByLabelText('Display password');
    fireEvent.change(input, { target: { value: 'mentor-configured-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Unlock display' }));

    expect(await screen.findByText('0489')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/attendance-display/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('button', { name: 'Unlock display' })).toBeInTheDocument();
    expect(screen.queryByText('0489')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/attendance-display/logout',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    );
  });
});
