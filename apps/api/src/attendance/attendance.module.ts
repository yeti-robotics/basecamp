import { Module } from '@nestjs/common';
import { AttendanceCommands } from './attendance.commands.js';
import { AttendanceService } from './attendance.service.js';
import { AttendanceCodeService } from './attendance-code.service.js';
import { AttendanceRepository } from './attendance.repository.js';
import { DatabaseModule } from '../database/database.module.js';

@Module({
  imports: [DatabaseModule],
  providers: [AttendanceCommands, AttendanceService, AttendanceCodeService, AttendanceRepository],
})
export class AttendanceModule {}
