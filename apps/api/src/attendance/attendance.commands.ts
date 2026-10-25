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
import {
  getSeasonDataStartForDate,
  getTotalSeasonHours,
} from "./schedule.util.js";

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
      return interaction.editReply(formatAttendanceError(result.error));
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

    const asOfDate = new Date();
    const [hoursResult, requirementsResult] = await Promise.all([
      this.attendanceService.getAttendanceSum(interaction.user.id, {
        category: "meeting",
        checkedInFrom: getSeasonDataStartForDate(asOfDate),
        checkedInThrough: asOfDate,
      }),
      this.attendanceService.getCurrentHourRequirements(
        interaction.user.id,
        asOfDate,
      ),
    ]);

    if (hoursResult.isErr() || requirementsResult.isErr()) {
      const error = hoursResult.isErr()
        ? hoursResult.error
        : requirementsResult.isErr()
          ? requirementsResult.error
          : new Error("Unknown attendance lookup error");

      this.logger.error(
        `Error getting attendance for user ${interaction.user.id}: ${error.message}`,
      );

      await interaction.editReply(
        "There was an error getting your attendance or hour requirements. Please let a mentor know.",
      );
      return;
    }

    const hours = hoursResult.value;
    const requirements = requirementsResult.value;
    const totalPossibleHours =
      this.attendanceService.getTotalPossibleHoursToDate(asOfDate);
    const totalSeasonHours = getTotalSeasonHours(asOfDate);

    const memberRequiredHours =
      totalSeasonHours > 0
        ? totalPossibleHours * (requirements.member / totalSeasonHours)
        : 0;
    const leadershipRequiredHours =
      totalSeasonHours > 0
        ? totalPossibleHours * (requirements.leadership / totalSeasonHours)
        : 0;

    const hoursPercentage =
      totalPossibleHours > 0
        ? `${((hours / totalPossibleHours) * 100).toFixed(1)}`
        : "∞";
    const totalPossibleHoursDisplay = Math.floor(totalPossibleHours);

    if (hours >= leadershipRequiredHours) {
      await interaction.editReply(
        `You're currently above the minimum hours for leadership (${hours.toFixed(2)} hours, ${hoursPercentage}% of ${totalPossibleHoursDisplay} possible hours to date)! :tada:`,
      );
      return;
    }

    if (hours >= memberRequiredHours) {
      const remainingHours = Math.ceil(leadershipRequiredHours - hours);

      await interaction.editReply(
        `You're currently above the minimum hours for members (${hours.toFixed(2)} hours, ${hoursPercentage}% of ${totalPossibleHoursDisplay} possible hours to date)! If you're on leadership, you are currently ${remainingHours} hour(s) behind the leadership requirement.`,
      );
      return;
    }

    const remainingHours = Math.ceil(memberRequiredHours - hours);

    await interaction.editReply(
      `You've got ${hours.toFixed(2)} hours (${hoursPercentage}% of ${totalPossibleHoursDisplay} possible hours to date). You are currently ${remainingHours} hour(s) behind the minimum hours goal. :rocket:`,
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