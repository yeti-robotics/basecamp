import { Injectable, UseFilters, UseGuards, ValidationPipe } from '@nestjs/common';
import { MessageFlags } from 'discord.js';
import type { SlashCommandContext } from 'necord';
import { Context, Options, SlashCommand } from 'necord';
import { AttendanceService } from './attendance.service.js';
import { AttendanceInteractionFilter } from './attendance-interaction.filter.js';
import { AttendanceCodeOptions } from './attendance-options.dto.js';
import { AttendanceThrottlerGuard } from './attendance-throttler.guard.js';

function formatAttendanceError(error: Error): string {
  switch (error.message) {
    case 'Invalid attendance code':
      return 'Invalid or expired code. Check the display and try again.';
    case 'User is already signed in':
      return "You're already signed in.";
    case 'User is already signed out':
      return "You're already signed out.";
    case 'User was not signed out because they have not signed in yet':
      return 'You need to sign in before signing out.';
    default:
      return 'Attendance could not be updated. Please try again or ask a mentor.';
  }
}

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

  @UseGuards(AttendanceThrottlerGuard)
  @UseFilters(AttendanceInteractionFilter)
  @SlashCommand({
    name: 'signin',
    description: 'Sign in to a YETI meeting at the zone',
  })
  async SigninCommand(
    @Context() [interaction]: SlashCommandContext,
    @Options(new ValidationPipe({ validateCustomDecorators: true })) options: AttendanceCodeOptions,
  ) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    const result = await this.attendanceService.signInWithCode(interaction.user.id, options.code);
    return interaction.editReply(
      result.isOk() ? 'Signed in.' : formatAttendanceError(result.error),
    );
  }

  @UseGuards(AttendanceThrottlerGuard)
  @UseFilters(AttendanceInteractionFilter)
  @SlashCommand({
    name: 'signout',
    description: 'Sign out of a YETI meeting at the zone',
  })
  async SignoutCommand(
    @Context() [interaction]: SlashCommandContext,
    @Options(new ValidationPipe({ validateCustomDecorators: true })) options: AttendanceCodeOptions,
  ) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    const result = await this.attendanceService.signOutWithCode(interaction.user.id, options.code);
    return interaction.editReply(
      result.isOk() ? 'Signed out.' : formatAttendanceError(result.error),
    );
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
