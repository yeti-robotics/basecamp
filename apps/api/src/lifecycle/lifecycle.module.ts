import { Module } from '@nestjs/common';
import { LifecycleCommands } from './lifecycle.commands.js';

@Module({
  providers: [LifecycleCommands],
})
export class LifecycleModule {}
