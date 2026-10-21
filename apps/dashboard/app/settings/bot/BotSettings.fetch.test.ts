import { getBotStatus } from '../../../lib/bot-settings';

jest.mock('next/headers', () => ({ headers: jest.fn() }));

import { headers } from 'next/headers';

it('forwards the session cookie without caching and never returns token data', async () => {
  (headers as jest.Mock).mockResolvedValue(new Headers({ cookie: 'session=portal-session' }));
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      desiredEnabled: false,
      tokenConfigured: true,
      connection: 'off',
      statusMessage: 'YETI ARE YOU READY?',
      token: 'must-not-reach-the-page',
      tokenCiphertext: 'must-not-reach-the-page-either',
    }),
  }) as jest.Mock;
  const result = await getBotStatus();
  expect(result).toEqual({
    desiredEnabled: false,
    tokenConfigured: true,
    connection: 'off',
    statusMessage: 'YETI ARE YOU READY?',
  });
  expect(JSON.stringify(result)).not.toContain('must-not-reach-the-page');
  expect(global.fetch).toHaveBeenCalledWith(
    'http://localhost:8000/api/settings/bot',
    expect.objectContaining({ headers: { cookie: 'session=portal-session' }, cache: 'no-store' }),
  );
});

it('returns no status for a forbidden actor', async () => {
  (headers as jest.Mock).mockResolvedValue(new Headers({ cookie: 'session=member' }));
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 }) as jest.Mock;
  await expect(getBotStatus()).resolves.toBeNull();
});
