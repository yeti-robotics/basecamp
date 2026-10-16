import { Injectable } from '@nestjs/common';
import type { SlashCommandContext } from 'necord';
import { Context, SlashCommand } from 'necord';

@Injectable()
export class OutreachCommands {
  @SlashCommand({
    name: 'outreach',
    description: 'Get your current outreach progress',
  })
  async OutreachCommand(@Context() [interaction]: SlashCommandContext) {
    await interaction.reply('Outreach command');
  }

  @SlashCommand({
    name: 'outreach-leaderboard',
    description: 'Show the top 5 members by outreach hours',
  })
  async OutreachLeaderboardCommand(@Context() [interaction]: SlashCommandContext) {
    await interaction.reply('Outreach leaderboard command');
  }
}
