import { Injectable } from '@nestjs/common';
import type { SlashCommandContext } from 'necord';
import { Context, SlashCommand } from 'necord';

@Injectable()
export class PingCommand {
  @SlashCommand({ name: 'ping', description: 'Ping the bot' })
  async onPing(@Context() [interaction]: SlashCommandContext) {
    await interaction.reply('Pong!');
  }
}
