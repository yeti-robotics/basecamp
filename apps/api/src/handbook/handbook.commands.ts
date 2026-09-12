import { Injectable } from '@nestjs/common';
import type { SlashCommandContext } from 'necord';
import { Context, SlashCommand } from 'necord';

@Injectable()
export class HandbookCommands {
  @SlashCommand({
    name: 'handbook',
    description: 'Ask the handbook a question',
  })
  async HandbookCommand(@Context() [interaction]: SlashCommandContext) {
    await interaction.reply('Handbook command');
  }
}
