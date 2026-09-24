import { Injectable } from '@nestjs/common';
import type { SlashCommandContext } from 'necord';
import { Context, SlashCommand } from 'necord';
import { AttendanceService } from './attendance.service.js';

@Injectable()
export class AttendanceCommands {
  constructor(private readonly attendanceService: AttendanceService) {}

  @SlashCommand({
    name: 'attendance',
    description: 'Get your current attendance',
  })
  async AttendanceCommand(@Context() [interaction]: SlashCommandContext) {
    await interaction.reply('Attendance command');
  }

  @SlashCommand({
    name: 'attendance-leaderboard',
    description: 'Show the top 5 members by attendance hours',
  })
  async AttendanceLeaderboardCommand(@Context() [interaction]: SlashCommandContext) {
    await interaction.reply('Attendance leaderboard command');
  }

  @SlashCommand({
    name: 'signin',
    description: 'Sign in to a YETI meeting at the zone',
  })
    async SigninCommand(@Context() [interaction]: SlashCommandContext) {
      const result = await this.attendanceService.recordAttendance(
    interaction.user.id,
    "meeting",
    null,
    );

  if (result.isErr()) {
    await interaction.reply({
      content: `Error signing in: ${result.error.message}. Please try again later or contact a web dev mentor if issue persists.`,
      flags: ["Ephemeral"],
    });

  return;
}

await interaction.reply(
  `<@${interaction.user.id}> has signed in.`,
);
  }

  @SlashCommand({
    name: 'signout',
    description: 'Sign out of a YETI meeting at the zone',
  })
  async SignoutCommand(@Context() [interaction]: SlashCommandContext) {
    await interaction.reply('Signout command');
  }

  @SlashCommand({
    name: 'admin-signin',
    description: 'Sign in another user (admin only)',
  })
  async AdminSigninCommand(@Context() [interaction]: SlashCommandContext) {
    await interaction.reply('Admin signin command');
  }

  @SlashCommand({
    name: 'admin-signout',
    description: 'Sign out another user (admin only)',
  })
  async AdminSignoutCommand(@Context() [interaction]: SlashCommandContext) {
    await interaction.reply('Admin signout command');
  }
}
