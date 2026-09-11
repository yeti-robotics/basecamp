import { Module } from '@nestjs/common';
import { HandbookCommand } from './handbook.commands.js';

@Module({
  providers: [HandbookCommand],
})
export class HandbookModule {}
