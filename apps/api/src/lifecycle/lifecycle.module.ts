import { Module } from '@nestjs/common';
import { LifecycleCommands } from './lifecycle.commands';

@Module({
    providers: [LifecycleCommands],
})
export class LifecycleModule {}
