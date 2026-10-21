import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AuthModule } from './auth.module.js';
import { LinkedDiscordAdmissionService } from './linked-discord-admission.service.js';

@Module({
  imports: [AuthModule, DatabaseModule],
  providers: [LinkedDiscordAdmissionService],
  exports: [LinkedDiscordAdmissionService],
})
export class LinkedDiscordAdmissionModule {}
