import { act, render, screen } from '@testing-library/react';
import { CodeDisplay } from './CodeDisplay';

const seed = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const startMs = 270_000;
const expiresAt = startMs + 43_200_000;

describe('facility code display', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(startMs));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('rotates a four-digit code locally and clears it when the session expires', async () => {
    const onExpired = jest.fn();
    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    render(<CodeDisplay secret={seed} expiresAt={expiresAt} onExpired={onExpired} />);
    expect(await screen.findByText('0489')).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });
    expect(await screen.findByText('3154')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    jest.setSystemTime(new Date(expiresAt));
    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    expect(screen.queryByText('3154')).not.toBeInTheDocument();
    expect(onExpired).toHaveBeenCalledTimes(1);
  });
});
