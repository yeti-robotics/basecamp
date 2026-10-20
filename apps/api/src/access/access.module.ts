import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { BootstrapService } from './bootstrap.service.js';

@Module({
  imports: [ConfigModule, DatabaseModule, AuthModule],
  providers: [BootstrapService],
  exports: [BootstrapService],
})
export class AccessModule {}
