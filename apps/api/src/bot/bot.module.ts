import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccessModule } from '../access/access.module.js';
import { SessionGuard } from '../access/session.guard.js';
import { TeamAdminGuard } from '../access/team-admin.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { BotController } from './bot.controller.js';
import { BotContextFactory } from './bot-context.factory.js';
import { BotRuntimeService } from './bot-runtime.service.js';
import { BotSettingsStore } from './bot-settings.store.js';
import { BotTokenCipher } from './bot-token-cipher.js';

@Module({
  imports: [ConfigModule, DatabaseModule, AuthModule, AccessModule],
  controllers: [BotController],
  providers: [
    BotContextFactory,
    BotRuntimeService,
    BotSettingsStore,
    BotTokenCipher,
    SessionGuard,
    TeamAdminGuard,
  ],
  exports: [BotRuntimeService],
})
export class BotModule {}
