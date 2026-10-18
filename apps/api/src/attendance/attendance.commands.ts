import { Injectable, Logger } from "@nestjs/common";
import type { SlashCommandContext } from "necord";
import { Context, SlashCommand } from "necord";
import { AttendanceService } from "./attendance.service.js";
import {
  getSeasonDataStartForDate,
  getTotalSeasonHours,
} from "./schedule.util.js";

@Injectable()
export class AttendanceCommands {
  private readonly logger = new Logger(AttendanceCommands.name);

  constructor(private readonly attendanceService: AttendanceService) {}

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

  @SlashCommand({
    name: "signin",
    description: "Sign in to a YETI meeting at the zone",
  })
  async SigninCommand(@Context() [interaction]: SlashCommandContext) {
    await interaction.deferReply();

    const result = await this.attendanceService.recordAttendance(
      interaction.user.id,
      "meeting",
      null,
    );

    if (result.isErr()) {
      await interaction.editReply(
        result.error.message === "User is already signed in"
          ? "You're already signed in."
          : "Something went wrong while signing you in. Please try again later or contact a web dev mentor if the issue persists.",
      );
      return;
    }

    await interaction.editReply(`<@${interaction.user.id}> has signed in.`);
  }

  @SlashCommand({
    name: "signout",
    description: "Sign out of a YETI meeting at the zone",
  })
  async SignoutCommand(@Context() [interaction]: SlashCommandContext) {
    await interaction.deferReply();

    const result = await this.attendanceService.updateAttendance(
      interaction.user.id,
      {
        checkedOutAt: new Date(),
      },
    );

    if (result.isErr()) {
      await interaction.editReply(
        result.error.message === "User is already signed out"
          ? "You're already signed out."
          : result.error.message ===
              "User was not signed out because they have not signed in yet"
            ? "You need to sign in before signing out."
            : "Something went wrong while signing you out. Please try again later or contact a web dev mentor if the issue persists.",
      );
      return;
    }

    await interaction.editReply(`<@${interaction.user.id}> has signed out.`);
  }

  @SlashCommand({
    name: "admin-signin",
    description: "Sign in another user (admin only)",
  })
  async AdminSigninCommand(@Context() [interaction]: SlashCommandContext) {
    await interaction.reply("Admin signin command");
  }

  @SlashCommand({
    name: "admin-signout",
    description: "Sign out another user (admin only)",
  })
  async AdminSignoutCommand(@Context() [interaction]: SlashCommandContext) {
    await interaction.reply("Admin signout command");
  }
}