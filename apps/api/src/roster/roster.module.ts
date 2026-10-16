import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { MemberContextService } from './member-context.service.js';
import { RosterService } from './roster.service.js';

@Module({
  imports: [ConfigModule, AuthModule, DatabaseModule],
  providers: [RosterService, MemberContextService],
  exports: [RosterService, MemberContextService],
})
export class RosterModule {}
