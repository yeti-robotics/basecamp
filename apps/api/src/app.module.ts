import { Module } from '@nestjs/common';
import { NecordModule } from 'necord';
import { IntentsBitField } from 'discord.js';
import { AttendanceModule } from './attendance/attendance.module';
import { LifecycleModule } from './lifecycle/lifecycle.module';
import { HandbookModule } from './handbook/handbook.module';
import { OutreachModule } from './outreach/outreach.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    NecordModule.forRoot({
      token: process.env.DISCORD_TOKEN!,
      intents: [IntentsBitField.Flags.Guilds],
    }),
    AttendanceModule,
    LifecycleModule,
    HandbookModule,
    OutreachModule,
    HealthModule,
  ]
})
export class AppModule {}