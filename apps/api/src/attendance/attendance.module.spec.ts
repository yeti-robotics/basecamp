import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { DatabaseService } from '../database/database.service.js';
import { AttendanceCommands } from './attendance.commands.js';
import { AttendanceModule } from './attendance.module.js';
import { AttendanceRepository } from './attendance.repository.js';
import { AttendanceService } from './attendance.service.js';

describe('AttendanceModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [AttendanceModule],
    })
      .overrideProvider(DatabaseService)
      .useValue({ db: {} })
      .compile();
  });

  it('should compile successfully', () => {
    expect(module).toBeDefined();
  });

  it('should provide AttendanceService', () => {
    const service = module.get(AttendanceService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(AttendanceService);
  });

  it('should provide AttendanceCommands', () => {
    const commands = module.get(AttendanceCommands);
    expect(commands).toBeDefined();
    expect(commands).toBeInstanceOf(AttendanceCommands);
  });

  it('should provide AttendanceRepository', () => {
    const repository = module.get(AttendanceRepository);
    expect(repository).toBeDefined();
    expect(repository).toBeInstanceOf(AttendanceRepository);
  });
});