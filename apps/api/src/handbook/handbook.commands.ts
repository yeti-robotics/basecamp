import { Injectable } from '@nestjs/common';
import { Context, SlashCommand } from 'necord';
import type { SlashCommandContext } from 'necord';

@Injectable()
export class HandbookCommand {
  @SlashCommand({
    name: 'handbook',
    description: 'Ask the handbook a question',
  })
  async onCommand(@Context() [interaction]: SlashCommandContext) {
    await interaction.reply('Handbook command');
  }
}
