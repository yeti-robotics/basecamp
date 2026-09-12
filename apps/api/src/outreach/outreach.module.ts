import { Module } from '@nestjs/common';
import { OutreachCommands } from './outreach.commands.js';

@Module({
  providers: [OutreachCommands],
})
export class OutreachModule {}
