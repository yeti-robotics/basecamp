import { Module } from '@nestjs/common';
import { AttendanceCommands } from './attendance.commands.js';

@Module({
  providers: [AttendanceCommands],
})
export class AttendanceModule {}
