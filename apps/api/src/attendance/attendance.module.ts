import { Module } from '@nestjs/common';
import {
  AdminSigninCommand,
  AdminSignoutCommand,
  AttendanceCommand,
  AttendanceLeaderboardCommand,
  OutreachCommand,
  OutreachLeaderboardCommand,
  SigninCommand,
  SignoutCommand,
} from './attendance.commands.js';

@Module({
  providers: [
    AttendanceCommand,
    OutreachCommand,
    AttendanceLeaderboardCommand,
    OutreachLeaderboardCommand,
    SigninCommand,
    SignoutCommand,
    AdminSigninCommand,
    AdminSignoutCommand,
  ],
})
export class AttendanceModule {}
