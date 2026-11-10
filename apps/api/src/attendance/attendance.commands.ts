import {
  Injectable,
  Logger,
  UseFilters,
  UseGuards,
  ValidationPipe,
} from "@nestjs/common";
import { MessageFlags, type User, type ChatInputCommandInteraction } from "discord.js";
import type { Result } from "neverthrow";
import type { SlashCommandContext } from "necord";
import { Context, Options, SlashCommand, UserOption } from "necord";
import { AttendanceService } from "./attendance.service.js";
import { AttendanceInteractionFilter } from "./attendance-interaction.filter.js";
import { AttendanceCodeOptions } from "./attendance-options.dto.js";
import { AttendanceThrottlerGuard } from "./attendance-throttler.guard.js";

class MentorAttendanceOptions {
  @UserOption({
    name: "user",
    description: "The member to sign in or out",
    required: true,
  })
  user!: User;
}

function formatAttendanceError(error: Error): string {
  switch (error.message) {
    case "Invalid attendance code":
      return "Invalid or expired code. Check the display and try again.";
    case "User is already signed in":
      return "You're already signed in.";
    case "User is already signed out":
      return "You're already signed out.";
    case "User was not signed out because they have not signed in yet":
      return "You need to sign in before signing out.";
    case "Not authorized to manage attendance":
      return "Only active mentors and Team Admins can use this command.";
    default:
      return "Attendance could not be updated. Please try again or ask a mentor.";
  }
}

function formatMentorAttendanceError(error: Error, target: User): string {
  const member = `<@${target.id}>`;

  switch (error.message) {
    case "User is already signed in":
      return `${member} is already signed in.`;
    case "User is already signed out":
      return `${member} is already signed out.`;
    case "User was not signed out because they have not signed in yet":
      return `${member} has not signed in yet.`;
    case "Not authorized to manage attendance":
      return "Only active mentors and Team Admins can use this command.";
    default:
      return `Could not update attendance for ${member}. Please try again or ask a mentor.`;
  }
}

@Injectable()
export class AttendanceCommands {
  private readonly logger = new Logger(AttendanceCommands.name);

  constructor(private readonly attendanceService: AttendanceService) {}

  private async handleMentorAttendanceResult(
    interaction: ChatInputCommandInteraction,
    target: User,
    action: "sign in" | "sign out",
    result: Result<void, Error>,
  ) {
    if (result.isErr()) {
      this.logger.error(
        `Mentor ${action} failed for target ${target.id}: ${result.error.message}`,
      );
      return interaction.editReply(formatMentorAttendanceError(result.error, target));
    }

    const pastTense = action === "sign in" ? "signed in" : "signed out";
    const channel = interaction.channel;

    if (channel?.isSendable()) {
      await channel
        .send(`<@${target.id}> has been ${pastTense} by <@${interaction.user.id}>.`)
        .catch((error: unknown) => {
          this.logger.warn(
            `Could not announce mentor ${action} for ${target.id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        });
    }

    return interaction.editReply(`Successfully ${pastTense} ${target.username}.`);
  }

  @SlashCommand({
    name: "attendance",
    description: "Get your current attendance",
  })
  async AttendanceCommand(@Context() [interaction]: SlashCommandContext) {
    await interaction.deferReply();

    const result = await this.attendanceService.getOverviewForDiscordUser(
      interaction.user.id,
    );
    const overview = result.isOk() ? result.value : null;
    const expected = overview?.progress?.expectedHours;

    if (!overview?.progress || !expected || expected.member === null) {
      this.logger.error(
        `Error getting attendance for user ${interaction.user.id}: ${
          result.isErr()
            ? result.error.message
            : "No active season membership or hour requirement"
        }`,
      );

      await interaction.editReply(
        "There was an error getting your attendance or hour requirements. Please let a mentor know.",
      );
      return;
    }

    const progress = overview.progress;
    const hours = overview.hours.meeting;
    const memberRequiredHours = expected.member;
    const leadershipRequiredHours = expected.leadership ?? memberRequiredHours;
    const possibleHours = progress.completedMeetingHours;
    const hoursPercentage =
      possibleHours > 0 ? `${((hours / possibleHours) * 100).toFixed(1)}` : "∞";
    const possibleHoursDisplay = Math.floor(possibleHours);
    const meetings = `\nMeetings so far: ${progress.attendedMeetings} attended, ${progress.excusedMeetings} excused, ${progress.missedMeetings} missed (of ${progress.completedMeetings}).`;

    if (hours >= leadershipRequiredHours) {
      await interaction.editReply(
        `You're currently above the minimum hours for leadership (${hours.toFixed(2)} hours, ${hoursPercentage}% of ${possibleHoursDisplay} possible hours to date)! :tada:${meetings}`,
      );
      return;
    }

    if (hours >= memberRequiredHours) {
      const remainingHours = Math.ceil(leadershipRequiredHours - hours);

      await interaction.editReply(
        `You're currently above the minimum hours for members (${hours.toFixed(2)} hours, ${hoursPercentage}% of ${possibleHoursDisplay} possible hours to date)! If you're on leadership, you are currently ${remainingHours} hour(s) behind the leadership requirement.${meetings}`,
      );
      return;
    }

    const remainingHours = Math.ceil(memberRequiredHours - hours);

    await interaction.editReply(
      `You've got ${hours.toFixed(2)} hours (${hoursPercentage}% of ${possibleHoursDisplay} possible hours to date). You are currently ${remainingHours} hour(s) behind the minimum hours goal. :rocket:${meetings}`,
    );
  }

  @SlashCommand({
    name: "attendance-leaderboard",
    description: "Show the top 5 members by attendance hours",
  })
  async AttendanceLeaderboardCommand(@Context() [interaction]: SlashCommandContext) {
    await interaction.reply("Attendance leaderboard command");
  }

  @UseGuards(AttendanceThrottlerGuard)
  @UseFilters(AttendanceInteractionFilter)
  @SlashCommand({
    name: "signin",
    description: "Sign in to a YETI meeting at the zone",
  })
  async SigninCommand(
    @Context() [interaction]: SlashCommandContext,
    @Options(new ValidationPipe({ validateCustomDecorators: true }))
    options: AttendanceCodeOptions,
  ) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    const result = await this.attendanceService.signInWithCode(
      interaction.user.id,
      options.code,
    );
    return interaction.editReply(
      result.isOk() ? "Signed in." : formatAttendanceError(result.error),
    );
  }

  @UseGuards(AttendanceThrottlerGuard)
  @UseFilters(AttendanceInteractionFilter)
  @SlashCommand({
    name: "signout",
    description: "Sign out of a YETI meeting at the zone",
  })
  async SignoutCommand(
    @Context() [interaction]: SlashCommandContext,
    @Options(new ValidationPipe({ validateCustomDecorators: true }))
    options: AttendanceCodeOptions,
  ) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    const result = await this.attendanceService.signOutWithCode(
      interaction.user.id,
      options.code,
    );
    return interaction.editReply(
      result.isOk() ? "Signed out." : formatAttendanceError(result.error),
    );
  }

  @SlashCommand({
    name: "mentor-signin",
    description: "Sign in a member (mentor or Team Admin only)",
  })
  async MentorSigninCommand(
    @Context() [interaction]: SlashCommandContext,
    @Options() options: MentorAttendanceOptions,
  ) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    const result = await this.attendanceService.signInForMember(
      interaction.user.id,
      options.user.id,
    );
    return this.handleMentorAttendanceResult(
      interaction,
      options.user,
      "sign in",
      result,
    );
  }

  @SlashCommand({
    name: "mentor-signout",
    description: "Sign out a member (mentor or Team Admin only)",
  })
  async MentorSignoutCommand(
    @Context() [interaction]: SlashCommandContext,
    @Options() options: MentorAttendanceOptions,
  ) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    const result = await this.attendanceService.signOutForMember(
      interaction.user.id,
      options.user.id,
    );
    return this.handleMentorAttendanceResult(
      interaction,
      options.user,
      "sign out",
      result,
    );
  }
}