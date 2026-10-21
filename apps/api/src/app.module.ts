import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AttendanceModule } from './attendance/attendance.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BotModule } from './bot/bot.module.js';
import { configOptions } from './config.options.js';
import { HandbookModule } from './handbook/handbook.module.js';
import { HealthModule } from './health/health.module.js';
import { LifecycleModule } from './lifecycle/lifecycle.module.js';
import { OutreachModule } from './outreach/outreach.module.js';
import { RosterModule } from './roster/roster.module.js';
import { SeasonsModule } from './seasons/seasons.module.js';

@Module({
  imports: [
    ConfigModule.forRoot(configOptions),
    BotModule,
    AttendanceModule,
    AuthModule,
    LifecycleModule,
    HandbookModule,
    OutreachModule,
    RosterModule,
    SeasonsModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
