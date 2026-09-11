import { Module } from '@nestjs/common';
import { AttendanceCommands } from './attendance.commands';

@Module({
    providers: [AttendanceCommands],
})
export class AttendanceModule {}
