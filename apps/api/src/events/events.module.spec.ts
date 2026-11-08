import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AUTH } from '../auth/auth.module.js';
import { DatabaseService } from '../database/database.service.js';
import { EventsController } from './events.controller.js';
import { EventsModule } from './events.module.js';
import { EventsService } from './events.service.js';

describe('EventsModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [EventsModule],
    })
      .overrideProvider(AUTH)
      .useValue({ api: {} })
      .overrideProvider(DatabaseService)
      .useValue({ db: {} })
      .compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('should compile successfully', () => {
    expect(module).toBeDefined();
  });

  it('should provide EventsController', () => {
    expect(module.get(EventsController)).toBeInstanceOf(EventsController);
  });

  it('should provide EventsService', () => {
    const service = module.get(EventsService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(EventsService);
  });
});
