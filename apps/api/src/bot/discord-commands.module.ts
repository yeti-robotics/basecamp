import { Module } from '@nestjs/common';
import { AttendanceCommands } from '../attendance/attendance.commands.js';
import { AttendanceModule } from '../attendance/attendance.module.js';
import { LifecycleCommands } from '../lifecycle/lifecycle.commands.js';
import { LifecycleModule } from '../lifecycle/lifecycle.module.js';

@Module({
  imports: [AttendanceModule, LifecycleModule],
  providers: [AttendanceCommands, LifecycleCommands],
})
export class DiscordCommandsModule {}
