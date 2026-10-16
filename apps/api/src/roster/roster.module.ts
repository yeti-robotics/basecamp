import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccessModule } from '../access/access.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { MemberContextService } from './member-context.service.js';
import { RosterController } from './roster.controller.js';
import { RosterService } from './roster.service.js';

@Module({
  imports: [ConfigModule, AuthModule, DatabaseModule, AccessModule],
  controllers: [RosterController],
  providers: [RosterService, MemberContextService],
  exports: [RosterService, MemberContextService],
})
export class RosterModule {}
