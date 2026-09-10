import { Module } from '@nestjs/common';
import { HandbookCommand } from './handbook.commands';

@Module({
    providers: [HandbookCommand],
})
export class HandbookModule {}
