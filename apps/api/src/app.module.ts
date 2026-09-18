import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AttendanceModule } from './attendance/attendance.module.js';
import { HandbookModule } from './handbook/handbook.module.js';
import { LifecycleModule } from './lifecycle/lifecycle.module.js';
import { OutreachModule } from './outreach/outreach.module.js';
import { HealthModule } from './health/health.module.js';
import { IntentsBitField } from 'discord.js';
import { NecordModule } from 'necord';

@Module({
  imports: [
    NecordModule.forRoot({
            token: process.env.DISCORD_BOT_TOKEN!,
            intents: [ IntentsBitField.Flags.Guilds],
            development: [process.env.DISCORD_DEVELOPMENT_GUILD_ID!]
        }),
    AttendanceModule,
    LifecycleModule,
    HandbookModule,
    OutreachModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
