import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  end: vi.fn<() => Promise<void>>(),
  pool: { end: vi.fn<() => Promise<void>>() },
  Pool: vi.fn(),
}));

vi.mock('pg', () => ({ Pool: mocks.Pool }));

import { DatabaseModule } from './database.module.js';
import { DatabaseService } from './database.service.js';

describe('DatabaseService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.end.mockResolvedValue(undefined);
    mocks.pool.end = mocks.end;
    mocks.Pool.mockImplementation(() => mocks.pool);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function makeApplication(databaseUrl: string) {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ DATABASE_URL: databaseUrl })],
        }),
        DatabaseModule,
      ],
    }).compile();
    const app = module.createNestApplication();
    await app.init();
    return { app, module };
  }

  it('creates one pool for the module and awaits pool shutdown', async () => {
    let resolveEnd!: () => void;
    mocks.end.mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveEnd = resolve;
    }));

    const { app, module } = await makeApplication('postgresql://test:test@localhost/test');
    expect(module.get(DatabaseService)).toBe(module.get(DatabaseService));
    expect(mocks.Pool).toHaveBeenCalledTimes(1);
    expect(mocks.Pool).toHaveBeenCalledWith(expect.objectContaining({
      connectionString: 'postgresql://test:test@localhost/test',
    }));

    let closed = false;
    const closing = app.close().then(() => { closed = true; });
    await vi.waitFor(() => expect(mocks.end).toHaveBeenCalledTimes(1));
    expect(closed).toBe(false);
    resolveEnd();
    await closing;
    expect(closed).toBe(true);
    expect(mocks.end).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['', 'DATABASE_URL must be set to a PostgreSQL URL'],
    ['not a url', 'DATABASE_URL must be a PostgreSQL URL'],
    ['https://user:secret@example.test/db', 'DATABASE_URL must be a PostgreSQL URL'],
  ])('rejects invalid configuration %j without exposing it', async (databaseUrl, message) => {
    await expect(makeApplication(databaseUrl)).rejects.toThrow(message);
    expect(mocks.Pool).not.toHaveBeenCalled();
    expect(message).not.toContain('secret');
  });
});
