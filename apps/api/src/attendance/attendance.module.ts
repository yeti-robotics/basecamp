import { Module } from '@nestjs/common';
import { AttendanceCommands } from './attendance.commands.js';
import { AttendanceService } from './attendance.service.js';
import { AttendanceRepository } from './attendance.repository.js';

@Module({
  providers: [AttendanceCommands, AttendanceService, AttendanceRepository],
})
export class AttendanceModule {}
