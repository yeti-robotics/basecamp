import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccessModule } from '../access/access.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { RosterModule } from '../roster/roster.module.js';
import { SeasonAuthorizationService } from './season-authorization.service.js';
import { SeasonsController } from './seasons.controller.js';
import { SeasonsService } from './seasons.service.js';

@Module({
  imports: [ConfigModule, DatabaseModule, AuthModule, AccessModule, RosterModule],
  controllers: [SeasonsController],
  providers: [SeasonAuthorizationService, SeasonsService],
  exports: [SeasonsService, SeasonAuthorizationService],
})
export class SeasonsModule {}
