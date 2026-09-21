import { Module } from '@nestjs/common';
import { AttendanceCommands } from './attendance.commands.js';
import { AttendanceService } from './attendance.service.js';

@Module({
  providers: [AttendanceCommands, AttendanceService],
})
export class AttendanceModule {}
