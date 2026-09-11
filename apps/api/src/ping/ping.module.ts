import { Module } from '@nestjs/common';
import { PingCommand } from './ping.commands.js';

@Module({
  providers: [PingCommand],
})
export class PingModule {}
