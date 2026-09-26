import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createAuth } from '../auth.js';
import { DatabaseModule } from '../database/database.module.js';
import { DatabaseService } from '../database/database.service.js';

export const AUTH = Symbol('AUTH');

@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [
    {
      provide: AUTH,
      inject: [DatabaseService, ConfigService],
      useFactory: (database: DatabaseService, config: ConfigService) =>
        createAuth(database.db, config),
    },
  ],
  exports: [AUTH],
})
export class AuthModule {}
