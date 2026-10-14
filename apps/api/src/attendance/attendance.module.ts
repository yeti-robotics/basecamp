import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { AttendanceCommands } from './attendance.commands.js';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceRepository } from './attendance.repository.js';
import { AttendanceService } from './attendance.service.js';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [AttendanceController],
  providers: [AttendanceCommands, AttendanceService, AttendanceRepository],
})
export class AttendanceModule {}
