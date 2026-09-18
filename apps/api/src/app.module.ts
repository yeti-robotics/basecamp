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
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
      NecordModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        token: config.getOrThrow<string>('DISCORD_TOKEN'),
        intents: [IntentsBitField.Flags.Guilds],
        development: [config.getOrThrow<string>('DISCORD_DEVELOPMENT_GUILD_ID')]
      })
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local']
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
