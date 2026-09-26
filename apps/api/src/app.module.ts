import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IntentsBitField } from 'discord.js';
import { NecordModule } from 'necord';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AttendanceModule } from './attendance/attendance.module.js';
import { AuthModule } from './auth/auth.module.js';
import { apiEnvFiles } from './env.js';
import { HandbookModule } from './handbook/handbook.module.js';
import { HealthModule } from './health/health.module.js';
import { LifecycleModule } from './lifecycle/lifecycle.module.js';
import { OutreachModule } from './outreach/outreach.module.js';

const discordToken = process.env.DISCORD_TOKEN;
const discordDevelopmentGuildId = process.env.DISCORD_DEVELOPMENT_GUILD_ID;

@Module({
  imports: [
    ...(discordToken && discordDevelopmentGuildId
      ? [
          NecordModule.forRoot({
            token: discordToken,
            intents: [IntentsBitField.Flags.Guilds],
            development: [discordDevelopmentGuildId],
          }),
        ]
      : []),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: apiEnvFiles,
    }),
    AttendanceModule,
    AuthModule,
    LifecycleModule,
    HandbookModule,
    OutreachModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
