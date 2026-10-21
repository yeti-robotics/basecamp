import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BotSettingsStore } from './bot-settings.store.js';

let row: { id: number; enabled: boolean; token_ciphertext: string | null } | undefined;

const database = {
  select: vi.fn(() => {
    const query = {
      from: vi.fn(() => query),
      where: vi.fn(() => query),
      limit: vi.fn(async () =>
        row ? [{ enabled: row.enabled, tokenCiphertext: row.token_ciphertext }] : [],
      ),
    };
    return query;
  }),
  insert: vi.fn(() => ({
    values: vi.fn((values: Partial<NonNullable<typeof row>>) => ({
      onConflictDoUpdate: vi.fn(({ set }: { set: Partial<NonNullable<typeof row>> }) => {
        row = row
          ? { ...row, ...set }
          : {
              id: values.id ?? 1,
              enabled: values.enabled ?? false,
              token_ciphertext: values.token_ciphertext ?? null,
            };
      }),
    })),
  })),
};

function makeStore() {
  return new BotSettingsStore({ db: database } as never);
}

describe('BotSettingsStore', () => {
  beforeEach(() => {
    row = undefined;
    vi.clearAllMocks();
  });

  it('starts disabled with no saved token when the singleton row does not exist', async () => {
    await expect(makeStore().load()).resolves.toEqual({ enabled: false, tokenCiphertext: null });
  });

  it('persists an enabled flag across store instances', async () => {
    await makeStore().setEnabled(true);

    await expect(makeStore().load()).resolves.toEqual({ enabled: true, tokenCiphertext: null });
  });

  it('persists a disabled flag across store instances', async () => {
    await makeStore().setEnabled(true);
    await makeStore().setEnabled(false);

    await expect(makeStore().load()).resolves.toEqual({ enabled: false, tokenCiphertext: null });
  });

  it('saving a token does not enable the bot', async () => {
    await makeStore().setToken('encrypted-token');

    await expect(makeStore().load()).resolves.toEqual({
      enabled: false,
      tokenCiphertext: 'encrypted-token',
    });
  });

  it('preserves the token when enabling and disabling the bot', async () => {
    await makeStore().setToken('encrypted-token');
    await makeStore().setEnabled(true);
    await makeStore().setEnabled(false);

    await expect(makeStore().load()).resolves.toEqual({
      enabled: false,
      tokenCiphertext: 'encrypted-token',
    });
  });
});
