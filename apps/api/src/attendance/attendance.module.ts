import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from '../database/database.module.js';
import { AttendanceCommands } from './attendance.commands.js';
import { AttendanceRepository } from './attendance.repository.js';
import { AttendanceService } from './attendance.service.js';
import { AttendanceCodeService } from './attendance-code.service.js';
import { AttendanceInteractionFilter } from './attendance-interaction.filter.js';
import { AttendanceThrottlerGuard } from './attendance-throttler.guard.js';
import { DisplayController } from './display.controller.js';
import { DisplaySessionService } from './display-session.service.js';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    ThrottlerModule.forRoot([{ name: 'attendance', ttl: 60_000, limit: 5 }]),
  ],
  controllers: [DisplayController],
  providers: [
    AttendanceCommands,
    AttendanceService,
    AttendanceCodeService,
    AttendanceRepository,
    AttendanceThrottlerGuard,
    AttendanceInteractionFilter,
    DisplaySessionService,
  ],
})
export class AttendanceModule {}
