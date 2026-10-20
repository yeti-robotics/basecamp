import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AccessService } from '../access/access.service.js';
import { createAuth } from '../auth.js';
import { DatabaseModule } from '../database/database.module.js';
import { DatabaseService } from '../database/database.service.js';
import { DiscordAdmissionService } from './discord-admission.service.js';

export const AUTH = Symbol('AUTH');
export const DISCORD_ADMISSION = Symbol('DISCORD_ADMISSION');

@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [
    {
      provide: DISCORD_ADMISSION,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new DiscordAdmissionService(config),
    },
    {
      provide: AUTH,
      inject: [DatabaseService, ConfigService, DISCORD_ADMISSION, AccessService],
      useFactory: (
        database: DatabaseService,
        config: ConfigService,
        admission: DiscordAdmissionService,
        access: AccessService,
      ) => createAuth(database.db, config, admission, access),
    },
    AccessService,
  ],
  exports: [AUTH, DISCORD_ADMISSION, AccessService],
})
export class AuthModule {}
