import { Module } from '@nestjs/common';
import { HandbookCommands } from './handbook.commands.js';

@Module({
  providers: [HandbookCommands],
})
export class HandbookModule {}
