import { Module } from '@nestjs/common';
import { HandbookCommands } from './handbook.commands';

@Module({
    providers: [HandbookCommands],
})
export class HandbookModule {}
