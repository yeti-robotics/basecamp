import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { LifecycleCommands } from './lifecycle.commands.js';
import { LifecycleService } from './lifecycle.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [LifecycleCommands, LifecycleService],
})
export class LifecycleModule {}
