import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../database/database.service.js';
import { LifecycleModule } from './lifecycle.module.js';
import { LifecycleService } from './lifecycle.service.js';

describe('LifecycleModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [LifecycleModule],
    })
      .overrideProvider(DatabaseService)
      .useValue({ db: { execute: vi.fn() } })
      .compile();
  });

  it('should compile successfully', () => {
    expect(module).toBeDefined();
  });

  it('should provide LifecycleService', () => {
    const service = module.get(LifecycleService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(LifecycleService);
  });
});
