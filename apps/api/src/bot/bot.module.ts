import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module.js';
import { BotContextFactory } from './bot-context.factory.js';
import { BotRuntimeService } from './bot-runtime.service.js';
import { BotSettingsStore } from './bot-settings.store.js';
import { BotTokenCipher } from './bot-token-cipher.js';

@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [BotContextFactory, BotRuntimeService, BotSettingsStore, BotTokenCipher],
  exports: [BotRuntimeService],
})
export class BotModule {}
