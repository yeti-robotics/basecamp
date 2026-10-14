import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from '../database/database.module.js';
import { AttendanceCommands } from './attendance.commands.js';
import { AttendanceRepository } from './attendance.repository.js';
import { AttendanceService } from './attendance.service.js';
import { AttendanceCodeService } from './attendance-code.service.js';
import { AttendanceInteractionFilter } from './attendance-interaction.filter.js';
import { AttendanceThrottlerGuard } from './attendance-throttler.guard.js';

@Module({
  imports: [
    DatabaseModule,
    ThrottlerModule.forRoot([{ name: 'attendance', ttl: 60_000, limit: 5 }]),
  ],
  providers: [
    AttendanceCommands,
    AttendanceService,
    AttendanceCodeService,
    AttendanceRepository,
    AttendanceThrottlerGuard,
    AttendanceInteractionFilter,
  ],
})
export class AttendanceModule {}
