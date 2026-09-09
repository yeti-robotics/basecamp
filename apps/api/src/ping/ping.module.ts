import { Module } from '@nestjs/common';
import { PingCommand } from './ping.commands';

@Module({
    providers: [PingCommand],
})
export class PingModule {}
