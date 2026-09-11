import { Injectable } from "@nestjs/common";
import { Context, SlashCommand, type SlashCommandContext } from "necord";

@Injectable()
export class LifecycleCommands {
    @SlashCommand({name: "ping", description: "Ping the bot"})
    async PingCommand(@Context() [interaction]: SlashCommandContext) {
        await interaction.reply("Pong!");
    }
}