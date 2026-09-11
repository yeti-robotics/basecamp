import { Module } from '@nestjs/common';
import {
  AttendanceCommand,
  OutreachCommand,
  AttendanceLeaderboardCommand,
  OutreachLeaderboardCommand,
  AdminSigninCommand,
  AdminSignoutCommand,
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
