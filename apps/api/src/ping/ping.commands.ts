import { Command, Handler, InteractionEvent } from "@discord-nestjs/core";
import { ChatInputCommandInteraction } from "discord.js";

@Command({name: "ping", description: "Ping the bot"})
export class PingCommand {
    @Handler()
    async onCommand(@InteractionEvent() interaction: ChatInputCommandInteraction) {
        await interaction.reply("Pong!");
    }
}