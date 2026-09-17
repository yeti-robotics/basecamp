import { Module } from '@nestjs/common';
import { LifecycleCommands } from './lifecycle.commands.js';
import { LifecycleService } from './lifecycle.service.js';

@Module({
  providers: [LifecycleCommands, LifecycleService],
})
export class LifecycleModule {}
