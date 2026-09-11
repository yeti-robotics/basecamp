import { Module } from '@nestjs/common';
import { OutreachCommands } from './outreach.commands';

@Module({
    providers: [OutreachCommands],
})
export class OutreachModule {}
