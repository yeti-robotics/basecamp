import { Command, Handler, InteractionEvent } from "@discord-nestjs/core";
import { ChatInputCommandInteraction } from "discord.js";

@Command({name: "attendance", description: "Get your current attendance"})
export class AttendanceCommand {
    @Handler()
    async onCommand(@InteractionEvent() interaction: ChatInputCommandInteraction) {
        await interaction.reply("Attendance command");
    }
}

@Command({name: "outreach", description: "Get your current outreach progress"})
export class OutreachCommand {
    @Handler()
    async onCommand(@InteractionEvent() interaction: ChatInputCommandInteraction) {
        await interaction.reply("Outreach command");
    }
}

@Command({name: "attendance-leaderboard", description: "Show the top 5 members by attendance hours"})
export class AttendanceLeaderboardCommand {
    @Handler()
    async onCommand(@InteractionEvent() interaction: ChatInputCommandInteraction) {
        await interaction.reply("Attendance leaderboard command");
    }
}

@Command({name: "outreach-leaderboard", description: "Show the top 5 members by outreach hours"})
export class OutreachLeaderboardCommand {
    @Handler()
    async onCommand(@InteractionEvent() interaction: ChatInputCommandInteraction) {
        await interaction.reply("Outreach leaderboard command");
    }
}

@Command({name: "signin", description: "Sign in to a YETI meeting at the zone"})
export class SigninCommand {
    @Handler()
    async onCommand(@InteractionEvent() interaction: ChatInputCommandInteraction) {
        await interaction.reply("Signin command");
    }
}

@Command({name: "signout", description: "Sign out of a YETI meeting at the zone"})
export class SignoutCommand {
    @Handler()
    async onCommand(@InteractionEvent() interaction: ChatInputCommandInteraction) {
        await interaction.reply("Signout command");
    }
}

@Command({name: "admin-signin", description: "Sign in another user (admin only)"})
export class AdminSigninCommand {
    @Handler()
    async onCommand(@InteractionEvent() interaction: ChatInputCommandInteraction) {
        await interaction.reply("Admin signin command");
    }
}

@Command({name: "admin-signout", description: "Sign out another user (admin only)"})
export class AdminSignoutCommand {
    @Handler()
    async onCommand(@InteractionEvent() interaction: ChatInputCommandInteraction) {
        await interaction.reply("Admin signout command");
    }
}