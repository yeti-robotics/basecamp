import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { SeasonAuthorizationService } from '../seasons/season-authorization.service.js';
import { AccessController } from './access.controller.js';
import { BootstrapService } from './bootstrap.service.js';

@Module({
  imports: [ConfigModule, DatabaseModule, AuthModule],
  controllers: [AccessController],
  providers: [BootstrapService, SeasonAuthorizationService],
  exports: [BootstrapService, SeasonAuthorizationService],
})
export class AccessModule {}
