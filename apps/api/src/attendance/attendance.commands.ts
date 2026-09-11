import { Injectable } from '@nestjs/common';
import { Context, SlashCommand } from 'necord';
import type { SlashCommandContext } from 'necord';

@Injectable()
export class AttendanceCommand {
  @SlashCommand({
    name: 'attendance',
    description: 'Get your current attendance',
  })
  async onCommand(@Context() [interaction]: SlashCommandContext) {
    await interaction.reply('Attendance command');
  }
}

@Injectable()
export class OutreachCommand {
  @SlashCommand({
    name: 'outreach',
    description: 'Get your current outreach progress',
  })
  async onCommand(@Context() [interaction]: SlashCommandContext) {
    await interaction.reply('Outreach command');
  }
}

@Injectable()
export class AttendanceLeaderboardCommand {
  @SlashCommand({
    name: 'attendance-leaderboard',
    description: 'Show the top 5 members by attendance hours',
  })
  async onCommand(@Context() [interaction]: SlashCommandContext) {
    await interaction.reply('Attendance leaderboard command');
  }
}

@Injectable()
export class OutreachLeaderboardCommand {
  @SlashCommand({
    name: 'outreach-leaderboard',
    description: 'Show the top 5 members by outreach hours',
  })
  async onCommand(@Context() [interaction]: SlashCommandContext) {
    await interaction.reply('Outreach leaderboard command');
  }
}

@Injectable()
export class SigninCommand {
  @SlashCommand({
    name: 'signin',
    description: 'Sign in to a YETI meeting at the zone',
  })
  async onCommand(@Context() [interaction]: SlashCommandContext) {
    await interaction.reply('Signin command');
  }
}

@Injectable()
export class SignoutCommand {
  @SlashCommand({
    name: 'signout',
    description: 'Sign out of a YETI meeting at the zone',
  })
  async onCommand(@Context() [interaction]: SlashCommandContext) {
    await interaction.reply('Signout command');
  }
}

@Injectable()
export class AdminSigninCommand {
  @SlashCommand({
    name: 'admin-signin',
    description: 'Sign in another user (admin only)',
  })
  async onCommand(@Context() [interaction]: SlashCommandContext) {
    await interaction.reply('Admin signin command');
  }
}

@Injectable()
export class AdminSignoutCommand {
  @SlashCommand({
    name: 'admin-signout',
    description: 'Sign out another user (admin only)',
  })
  async onCommand(@Context() [interaction]: SlashCommandContext) {
    await interaction.reply('Admin signout command');
  }
}
